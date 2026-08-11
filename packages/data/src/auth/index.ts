/**
 * @insight/data/auth — server-only authentication service.
 * Import via `@insight/data/auth` (kept out of the client-safe main index
 * because it uses Node built-ins for file-backed persistence and hashing).
 */
export { AuthenticationService, AuthValidationError } from "./AuthenticationService";
export type { AuthResult, AuthStore } from "./AuthenticationService";
