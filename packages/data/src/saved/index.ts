/**
 * @insight/data/saved — server-only saved-research persistence client.
 * Import via `@insight/data/saved` (uses Node fs for file-backed storage).
 */
export { SavedResearchClient, summarize } from "./SavedResearchClient";
export type { SavedResearchStore } from "./SavedResearchClient";