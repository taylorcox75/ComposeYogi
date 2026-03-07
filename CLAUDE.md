# CLAUDE.md — ComposeYogi AI Assistant Guide

ComposeYogi is a professional, browser-based Digital Audio Workstation (DAW) with an Ableton-style interface. It is built with Next.js 15 (App Router), Tone.js, TypeScript, and Zustand. The app is local-first (IndexedDB), PWA-enabled, and supports i18n (en, es).

---

## Repository Structure

```
app/[locale]/          # Next.js App Router with i18n locale prefix
  page.tsx             # Landing page
  compose/page.tsx     # Main DAW interface (primary feature)
  layout.tsx           # Root layout (fonts, metadata, providers)
  sw.ts                # Service Worker source (compiled → public/sw.js)

components/
  compose/             # DAW-specific UI components
    editors/           # DrumSequencer, PianoRoll, WaveformEditor
  ui/                  # Reusable Radix UI primitives (shadcn/ui)

lib/
  audio/               # Tone.js wrappers and audio features
    engine.ts          # Transport: play/stop/seek/loop
    playout.ts         # Clip scheduling, track signal chains
    recorder.ts        # Microphone input
    recording-manager.ts  # Multi-take recording + latency compensation
    latency-calibration.ts
    synth-presets.ts   # 24+ instrument presets
    sample-loader.ts   # Audio file loading + peaks caching
    sample-import.ts   # User sample import
    export.ts          # MIDI + audio export
    mp3-encoder.ts     # lamejs MP3 encoding wrapper
    offline-renderer.ts  # Offline audio rendering (export)
    project-io.ts      # Project serialization
  store/
    index.ts           # Selector exports (always import from here)
    project.ts         # Project state + zundo undo/redo (~790 LOC)
    playback.ts        # Playback state + refs (~285 LOC)
    ui.ts              # UI state (~309 LOC)
  persistence/
    db.ts              # IndexedDB schema
    autosave.ts        # Auto-save logic (30s interval)
    index.ts           # Save/load project operations
  canvas/
    GridRenderer.ts    # Beat grid + markers with DPR scaling
    WaveformRenderer.ts  # Peaks-based waveform visualization
  templates/
    demo-templates.ts  # 5 starter template presets
    loader.ts          # Template loading logic
  logger.ts            # Logging utility
  utils.ts             # cn(), time formatters, scale/note helpers

hooks/                 # Custom React hooks
  useAutosave.ts       # IndexedDB auto-save hook
  usePlaybackAnimation.ts  # Playhead animation loop (RAF)
  useClipDrag.ts       # @dnd-kit drag logic for clips
  usePWAInstall.ts     # PWA install prompt
  useOfflineStatus.ts  # Network connectivity detection
  useIsMobile.ts       # Mobile device detection
  useAudioWorker.ts    # Web Worker initialization
  index.ts             # Barrel export

types/index.ts         # Core TypeScript interfaces (Project, Track, Clip, Note, AudioTake)
config/
  app.ts               # APP_CONFIG constants (BPM range, max tracks, auto-save interval, etc.)
  i18n.ts              # Locale list configuration
messages/
  en.json              # English translations
  es.json              # Spanish translations
public/
  samples/             # Bundled audio samples (bass, drums-*, loops, vocals)
  workers/             # audio-peaks-worker.js, lame.min.js
  manifest.json        # PWA manifest
scripts/
  validate-locales.js  # Ensures en.json and es.json have identical keys
```

---

## Tech Stack

| Category | Library | Version |
|---|---|---|
| Framework | Next.js | 15.1.0 |
| Language | TypeScript | 5.7.2 (strict) |
| UI | React | 19.0.0 |
| Audio | Tone.js | 15.0.4 |
| State | Zustand | 5.0.2 |
| Undo/Redo | Zundo | 2.3.0 |
| Styling | Tailwind CSS | 3.4.17 |
| Headless UI | Radix UI | various |
| Drag & Drop | @dnd-kit | 6.3+ |
| Storage | idb (IndexedDB) | 8.0.1 |
| i18n | next-intl | 3.25.0 |
| Icons | Lucide React | 0.468.0 |
| Toasts | Sonner | 2.0.7 |
| Hotkeys | react-hotkeys-hook | 4.6.1 |
| Theme | next-themes | 0.4.6 |
| PWA | Serwist | 9.5.0 |
| MIDI export | @tonejs/midi | 2.0.28 |
| MP3 encoding | lamejs | 1.2.1 |

---

## Development Commands

```bash
npm run dev             # Start dev server with Turbopack (hot reload)
npm run build           # Validate + type-check + lint + Next.js build
npm run start           # Start production server
npm run check           # Run all validations without building
npm run lint            # ESLint (strict)
npm run type-check      # TypeScript (tsc --noEmit)
npm run validate:locales  # Check en.json and es.json key parity
```

**Note:** There is no automated test suite (no Jest/Vitest). Validation is done via TypeScript, ESLint, and `npm run build`.

---

## Architecture & Core Systems

### State Management (Zustand + Zundo)

Three stores live in `lib/store/`:
- **`project`**: Tracks, clips, notes, BPM, time signature. Wrapped with `temporal` (zundo) for undo/redo up to 100 steps.
- **`playback`**: Transport state (playing, recording, position). Contains `playbackRefs` for animation-loop values that must not trigger re-renders.
- **`ui`**: Panel visibility, selected track/clip, modal states.

Rules:
- Always import selectors from `lib/store/index.ts`, not directly from individual store files.
- State updates must be immutable: `set((state) => ({ ... }))`.
- Use `playbackRefs.isPlayingRef.current` etc. for values read inside animation loops — do not read Zustand state inside `requestAnimationFrame`.

### Audio Engine (Tone.js)

- `lib/audio/engine.ts`: Wraps `Tone.Transport`. Always call `await audioEngine.initialize()` before any playback operations.
- `lib/audio/playout.ts`: Schedules clips to Tone.js. Manages track signal chains: `gain → panner → effects → master`.
- `lib/audio/recorder.ts` + `recording-manager.ts`: Microphone input with latency compensation.
- **Always dispose Tone.js objects** (Players, Synths, Effects) in component cleanup / `useEffect` teardown to prevent audio graph leaks.
- Time units: Use **bars/beats** for UI state; convert to **seconds** via `Tone.getTransport().toSeconds('bars:beats:sixteenths')` when scheduling.
- Latency: Stored as `project.latencyOffset` in ms; applied during recording only.

### Data Model & Persistence

- Core types in `types/index.ts`: `Project`, `Track`, `Clip`, `Note`, `AudioTake`.
- IndexedDB schema in `lib/persistence/db.ts`. Separate object stores: `projects`, `tracks`, `clips`, `audioTakes`, `settings`.
- Projects store metadata only; tracks and clips are stored separately for efficient partial updates.
- Audio takes stored as `ArrayBuffer` with peaks JSON for waveform rendering.
- **Notes** are stored as a JSON string in `ClipRecord.notes` — always parse on read, stringify on write.
- Auto-save fires every 30 seconds (configurable in `config/app.ts` via `APP_CONFIG`).

### Canvas Rendering

- `lib/canvas/GridRenderer.ts`: Timeline grid with beat markers. Handles `devicePixelRatio` scaling.
- `lib/canvas/WaveformRenderer.ts`: Peaks-based waveform with zoom-level caching.
- Always scale canvas for DPR: `ctx.scale(dpr, dpr)`.
- Always clear before drawing; always `ctx.save()` / `ctx.restore()` around transformations.
- Use `requestAnimationFrame` for playhead animation (driven by `usePlaybackAnimation` hook).

### Clip Editors

Three editor components in `components/compose/editors/`:
- `DrumSequencer.tsx`: Step sequencer for drum tracks.
- `PianoRoll.tsx`: MIDI note editor with scale lock.
- `WaveformEditor.tsx`: Audio clip trim and fade editor.

### Drag & Drop

- Uses `@dnd-kit/core` and `@dnd-kit/sortable`.
- Clip drag logic lives in `hooks/useClipDrag.ts` (collision detection, beat snapping).

### Internationalization (next-intl)

- Routes are locale-prefixed via `app/[locale]/` and `middleware.ts`.
- Translation files: `messages/en.json` and `messages/es.json` — keys must always be identical.
- In components: `const t = useTranslations('compose.transport')` (use namespace).
- Run `npm run validate:locales` before committing any changes to translation files.

### PWA & Offline

- Service worker built by Serwist from `app/sw.ts` → `public/sw.js` (gitignored).
- `next.config.ts` sets `Cross-Origin-Opener-Policy: same-origin` (required for audio context).
- COEP is intentionally **not set** due to iOS Safari audio compatibility issues.

---

## Code Conventions

### File Naming

- Files: `kebab-case` — `track-list.tsx`, `audio-engine.ts`
- Components: `PascalCase` — `Transport.tsx`, `DrumSequencer.tsx`
- Hooks: `camelCase` prefixed with `use` — `useClipDrag.ts`

### Directory Organization

- Components grouped by feature: `components/compose/`, `components/ui/`
- Barrel `index.ts` exports in `components/ui/`, `hooks/`, `lib/store/`

### Code Style

- **Import order**: React → Next.js → external libraries → internal modules → types
- **Section banners**: `// ============================================`
- **Logging**: `const logger = createLogger('ComponentName')` at module level
- **Class utilities**: Always use `cn()` from `lib/utils.ts` (wraps `clsx` + `tailwind-merge`)
- Unused parameters/variables: prefix with `_` to suppress ESLint warnings

### Tailwind Design Tokens

Defined in `tailwind.config.ts`:
- 6 named track colors
- Custom animations: `pulse-beat`, `slide-up`, `glow`
- Standard spacing and sizing presets

---

## Common Pitfalls

- **Do not read Zustand state inside animation loops.** Use `playbackRefs` (plain refs) for values accessed inside `requestAnimationFrame`.
- **Always dispose Tone.js objects** when unmounting components. Undisposed `Player`, `Synth`, and `Effect` nodes accumulate and cause glitches.
- **Notes are JSON-stringified in IndexedDB.** Parse them with `JSON.parse(clip.notes)` on load.
- **Canvas context must be scaled for DPR.** Skipping this causes blurry rendering on retina displays.
- **Mobile view is playback-only.** Full editing requires desktop viewport. Use `useIsMobile()` to gate editing UI.
- **Do not set COEP headers.** iOS Safari breaks audio when COEP is present.
- **Always run `npm run validate:locales`** after editing any `messages/*.json` file.

---

## Key Configuration Values (from `config/app.ts`)

| Constant | Value |
|---|---|
| Default BPM | 120 |
| Min BPM | 40 |
| Max BPM | 300 |
| Max tracks | 16 |
| Max clips per track | 64 |
| Auto-save interval | 30,000 ms |
| Undo history limit | 100 steps |

---

## CI/CD

GitHub Actions workflow: `.github/workflows/docker-publish.yml`

- Triggers on push to `main` or version tags (`v*.*.*`), and on PRs to `main`.
- Builds a multi-stage Docker image (Node 20 Alpine), pushes to Docker Hub (`appsyogi/composeyogi`).
- Signs the image digest with cosign for supply chain security.
- Required secrets: `DOCKER_USERNAME`, `DOCKER_PASSWORD`.

Local Docker:
```bash
docker-compose up -d    # Runs production image on :3000
```

---

## Important File Locations

| Purpose | Path |
|---|---|
| Main DAW page | `app/[locale]/compose/page.tsx` |
| Store exports | `lib/store/index.ts` |
| Project store | `lib/store/project.ts` |
| Audio engine | `lib/audio/engine.ts` |
| Clip scheduler | `lib/audio/playout.ts` |
| Type definitions | `types/index.ts` |
| App constants | `config/app.ts` |
| Next.js config | `next.config.ts` |
| Tailwind config | `tailwind.config.ts` |
| i18n routing | `i18n/routing.ts`, `middleware.ts` |
| DB schema | `lib/persistence/db.ts` |
