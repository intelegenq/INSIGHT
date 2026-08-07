# Coding Guidelines

## TypeScript
- Use strict TypeScript; avoid `any`.
- Model domain state with explicit types and discriminated unions.
- Keep external API responses at the boundary and normalize them before use.

## UI
- Build small, accessible components with semantic HTML.
- Prefer composition over configuration-heavy components.
- Preserve readable loading, empty, and error states.

## Data and AI
- Never present generated content as verified fact without evidence.
- Keep time, source, and confidence metadata alongside material insights.
- Use deterministic code for deterministic transformations; reserve models for language and synthesis.

## Changes
- Keep commits focused and describe intent using Conventional Commit-style messages.
- Add or update tests alongside behavior changes.
- Do not commit credentials, private data, or generated build output.
