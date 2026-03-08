# AGENTS.md

## Cursor Cloud specific instructions

**ComposeYogi** is a standalone Next.js 15 browser-based DAW (Digital Audio Workstation). It is a single-service frontend app with no backend, no database, and no environment variables required. All persistence is client-side via IndexedDB.

### Running the app

- `npm run dev` starts the dev server with Turbopack on port 3000.
- The compose page is at `/en/compose` (or `/es/compose` for Spanish).

### Checks

See `package.json` scripts for all commands. Key ones:

| Command | Description |
|---------|-------------|
| `npm run lint` | ESLint (exit 0 = pass; warnings are expected) |
| `npm run type-check` | TypeScript `tsc --noEmit` |
| `npm run build` | Production build (runs `prebuild` first: locale validation + type-check + lint) |
| `npm run check` | Runs locale validation, type-check, and lint (strict — lint errors fail) |

### Gotchas

- The `next lint` deprecation warning is expected on Next.js 15.5+ and does not indicate a problem.
- There is no automated test suite (no Jest, Vitest, etc.); validation relies on `lint`, `type-check`, and `build`.
- Audio playback features require a browser with Web Audio API support; headless browser testing will not produce audio output.
