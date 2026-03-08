# ComposeYogi — Bug Fix & Feature Plan

## Overview
Eight issues to fix, each committed separately.

---

## Issue #1 — Editor in mobile bottom nav bar
**Problem:** The mobile bottom nav only shows Browser, Visualizer, Inspector. The editor appears inline above the nav, not as a proper nav item.

**Fix:**
- Add "Editor" button (Piano icon) to the mobile bottom nav (4 items total)
- Remove inline `EditorPanel`/`EditorCollapsedBar` from the mobile layout
- Show EditorPanel as a fixed overlay above the nav (same pattern as Browser/Inspector)
- Tapping Editor tab toggles the panel; opening editor closes other panels
- Files: `app/[locale]/compose/page.tsx`

---

## Issue #2 — Bottom nav overlapping panels / inspector bottom clipped
**Problem:** Multiple panels can open simultaneously and overlap each other. Inspector content is cut off at the bottom.

**Fix:**
- Enforce mutual exclusivity: opening one panel auto-closes others (single active panel at a time)
- Set `maxHeight` + `overflow-y-auto` properly on all overlay panels so they scroll internally
- For inspector: ensure it fills available height below header and above nav, with full scroll
- Panels: Browser, Visualizer, Inspector, Editor — only one open at a time on mobile
- Files: `app/[locale]/compose/page.tsx`, `components/compose/Inspector.tsx`

---

## Issue #3 — Drum beat / piano key tap doesn't produce sound
**Problem:** `playoutManager.previewNote()` requires:
  1. Audio engine initialized (`audioEngine.initialize()`)
  2. Playout manager initialized (`playoutManager.initialize()`)
  3. Clip already scheduled in `state.scheduledClips`

When the editor opens without ever pressing Play, none of these are done.

**Fix:**
- In `DrumSequencer.toggleStep` and `previewSound`, and in `PianoRoll` key/note click:
  - Call `audioEngine.initialize()` and `playoutManager.initialize()` (safe to call multiple times)
  - If clip not yet scheduled, call `playoutManager.scheduleProject(project)`
  - Then call `previewNote`
- Alternative: add a `ensureAudioReady(project)` helper in playout.ts
- Files: `components/compose/editors/DrumSequencer.tsx`, `components/compose/editors/PianoRoll.tsx`, `lib/audio/playout.ts`

---

## Issue #4 — No project-length handle on ruler for mobile
**Problem:** Project length is hardcoded at 32 bars (`DEFAULT_PROJECT_BARS`). There's no way to adjust it on mobile.

**Fix:**
- Add `projectLengthBars` field to the project store (default 32)
- Render a draggable "end" handle (vertical line + grab handle) at the end of the project on the ruler
- Dragging it adjusts `projectLengthBars` in the store
- The `contentWidth` and timeline grid use `projectLengthBars` instead of the constant
- Files: `lib/store/project.ts`, `components/compose/TrackList.tsx`, `types/index.ts`

---

## Issue #5 — Pinch to zoom in track pane
**Problem:** On mobile, the only zoom controls are buttons in the Transport bar. No pinch-to-zoom gesture.

**Fix:**
- Add `onTouchStart`/`onTouchMove` handlers (non-passive) to the scroll container in TrackList
- Track two-finger pinch: measure initial distance on touchstart with 2 fingers
- On touchmove with 2 fingers: compute new distance, derive zoom delta, call `setZoom`
- Anchor the zoom to the midpoint between the two fingers (like browser pinch-zoom)
- Files: `components/compose/TrackList.tsx`

---

## Issue #6 — Browser drag-and-drop broken on mobile
**Problems identified:**
1. Touch drag starts on `div` elements with `onTouchStart`, but the check `if (e.target.closest('button')) return` skips drag when the `+` button is tapped (correct) but may incorrectly skip parent containers
2. On mobile overlay, the browser panel is `fixed` and sits above the track list; `document.elementFromPoint` may return elements inside the browser panel itself (which is `pointer-events:none` for ghost but not for the panel)
3. The ghost element is appended to `document.body` but may be obscured
4. `touchend` on the document may not fire if the touch was captured by something else

**Fix:**
- Temporarily hide the browser overlay panel during drag (or set `pointer-events:none`) so `elementFromPoint` can reach the track lanes
- Better ghost positioning: offset from touch point to show above finger
- Ensure `data-track-id` attribute is set on track lane divs (verify it's there)
- Add fallback: if no `data-track-id` found, look for closest scrollable area and use track selection
- Files: `components/compose/BrowserPanel.tsx`, `app/[locale]/compose/page.tsx`

---

## Issue #7 — Delete individual sound object from timeline
**Problem:** Clips can only be deleted via keyboard shortcut (Delete/Backspace). No touch-friendly delete button on clips.

**Fix:**
- Add a trash icon button inside DraggableClip, shown when the clip is selected or hovered
- On mobile: always visible when selected (no hover state)
- Calls `deleteClip(clip.id)` from project store
- Position: top-right corner of clip (inside, small icon)
- Files: `components/compose/DraggableClip.tsx`, `lib/store/project.ts` (verify `deleteClip` action)

---

## Issue #8 — Duplicate button on sound objects
**Problem:** Clips can only be duplicated via Alt+drag (not mobile-friendly). No button for duplication.

**Fix:**
- Add a copy/duplicate icon button inside DraggableClip, shown when selected or hovered
- Calls `duplicateClip(clip.id)` from project store (already exists)
- Position: top-right corner next to delete button
- The duplicate is placed immediately after the original (same track, startBar + lengthBars)
- Files: `components/compose/DraggableClip.tsx`

---

## Commit Strategy
Each fix gets its own commit in order:
1. `fix: add editor to mobile bottom nav bar`
2. `fix: prevent panel overlap and fix inspector scroll on mobile`
3. `fix: initialize audio before drum/piano preview notes`
4. `feat: add draggable project-length end handle to ruler`
5. `feat: pinch-to-zoom gesture in track pane`
6. `fix: mobile browser drag-and-drop to track lanes`
7. `feat: delete button on timeline clips`
8. `feat: duplicate button on timeline clips`
