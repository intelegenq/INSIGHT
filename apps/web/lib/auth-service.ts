/**
 * M25 — Shared auth/saved-research singletons for server route handlers.
 * File-backed under .data/ so saved research persists across restarts.
 */
import { AuthenticationService } from "@insight/data/auth";
import { SavedResearchClient } from "@insight/data/saved";
import type { User } from "@insight/core";

let authService: AuthenticationService | undefined;
export function getAuthService(): AuthenticationService {
  if (!authService) authService = new AuthenticationService();
  return authService;
}

const savedClients = new Map<string, SavedResearchClient>();
export function getSavedResearch(userId: string): SavedResearchClient {
  let client = savedClients.get(userId);
  if (!client) {
    client = new SavedResearchClient({ userId });
    savedClients.set(userId, client);
  }
  return client;
}

/** Public-safe projection of a user (never exposes password hash). */
export function publicUser(user: User): User {
  const { ...safe } = user;
  return safe;
}