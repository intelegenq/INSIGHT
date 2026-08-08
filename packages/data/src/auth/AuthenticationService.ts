/**
 * M25 — User authentication service (framework-free, file-backed).
 *
 * Password hashing uses Node's built-in crypto (scrypt+salt, constant-time
 * comparison). Sessions are persisted as a JSON file under a data directory,
 * so saved research survives process restarts without requiring a database.
 * No external dependencies beyond @insight/core.
 */

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AuthSession, User, UserCredential } from "@insight/core";

export interface AuthStore {
  dataDir?: string;
  /** Hard-coded secret mixed into session tokens (never secrets, just entropy binder). */
  sessionSalt?: string;
}

export interface AuthResult {
  user: User;
  session: AuthSession;
}

/**
 * Validation error thrown by the auth service.
 *
 * Named "ValidationError" so it classifies as VALIDATION_ERROR (HTTP 400)
 * through normalizeError at the API boundary, without @insight/data having to
 * depend on @insight/runtime (which already depends on @insight/data).
 */
export class AuthValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function instanceOfAuthError(error: unknown): error is AuthValidationError {
  return error instanceof AuthValidationError;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Deterministic-ish hashing: scrypt with random per-record salt.
 * Returns "salt:hash" hex string. Not reversible.
 */
function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * AuthenticationService — register, login, session management, and persisted
 * storage of users + sessions as a JSON file under `dataDir`.
 */
export class AuthenticationService {
  private readonly dataDir: string;
  private readonly file: string;
  private users: Map<string, UserCredential> = new Map();
  private sessions: Map<string, AuthSession> = new Map();
  private readonly sessionSalt: string;

  constructor(options: AuthStore = {}) {
    this.dataDir = options.dataDir ?? join(process.cwd(), ".data", "auth");
    this.sessionSalt = options.sessionSalt ?? "insight-auth-v1";
    this.file = join(this.dataDir, "store.json");
    mkdirSync(this.dataDir, { recursive: true });
    this.load();
  }

  /** Register a new user and create an auth session. */
  register(email: string, password: string, displayName?: string): AuthResult {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new AuthValidationError("A valid email address is required.", "email");
    }
    if (password.length < 8) {
      throw new AuthValidationError("Password must be at least 8 characters.", "password");
    }
    if (this.users.has(normalizedEmail)) {
      throw new AuthValidationError("An account with this email already exists.", "email");
    }
    const credential: UserCredential = {
      id: this.nextId("user"),
      email: normalizedEmail,
      displayName: displayName?.trim() || normalizedEmail.split("@")[0] || "Researcher",
      passwordHash: hashPassword(password),
      createdAt: nowIso(),
    };
    this.users.set(normalizedEmail, credential);
    this.save();
    return this.createSession(credential);
  }

  /** Authenticate an email/password pair and return a session. */
  login(email: string, password: string): AuthResult {
    const normalizedEmail = email.trim().toLowerCase();
    const credential = this.users.get(normalizedEmail);
    if (!credential || !verifyPassword(password, credential.passwordHash)) {
      throw new AuthValidationError("Invalid email or password.", "credentials");
    }
    return this.createSession(credential);
  }

  /** Resolve the authenticated user for a session token (or undefined). */
  getUserForSession(token: string): User | undefined {
    const hashed = hashToken(token);
    const session = this.sessions.get(hashed);
    if (!session) return undefined;
    if (Date.parse(session.expiresAt) < Date.now()) {
      this.sessions.delete(hashed);
      this.save();
      return undefined;
    }
    for (const credential of this.users.values()) {
      if (credential.id === session.userId) {
        const { passwordHash: _passwordHash, ...user } = credential;
        return user;
      }
    }
    return undefined;
  }

  /** Invalidates a session token. */
  logout(token: string): void {
    this.sessions.delete(hashToken(token));
    this.save();
  }

  private createSession(credential: UserCredential): AuthResult {
    const rawToken = createHash("sha256")
      .update(`${credential.id}:${randomBytes(32).toString("hex")}:${this.sessionSalt}:${nowIso()}`)
      .digest("hex");
    const session: AuthSession = {
      token: rawToken,
      userId: credential.id,
      createdAt: nowIso(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };
    this.sessions.set(hashToken(rawToken), session);
    this.save();
    const { passwordHash: _passwordHash, ...user } = credential;
    return { user, session };
  }

  private nextId(prefix: string): string {
    return `${prefix}_${randomBytes(8).toString("hex")}`;
  }

  private load(): void {
    if (!existsSync(this.file)) return;
    try {
      const raw = JSON.parse(readFileSync(this.file, "utf-8")) as {
        users?: UserCredential[];
        sessions?: AuthSession[];
      };
      for (const u of raw.users ?? []) this.users.set(u.email, u);
      for (const s of raw.sessions ?? []) this.sessions.set(hashToken(s.token), s);
    } catch {
      // Corrupt store — start empty rather than crash.
      this.users = new Map();
      this.sessions = new Map();
    }
  }

  private save(): void {
    const payload = {
      users: [...this.users.values()],
      sessions: [...this.sessions.values()],
    };
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(payload, null, 2));
    } catch {
      // Persistence is best-effort; authentication still works in-memory.
    }
  }
}