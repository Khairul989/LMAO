# Changelog

## [0.3.1] - 2026-06-20

### Changed
- Tidied the mobile HUD: on touch devices the battery (top-left) and ammo (top-right) now
  sit at the top, clear of the bottom-right control cluster — no more overlap in portrait.
- Removed the redundant on-screen "drag to move / drag to look" hints (the tap-to-start
  screen already explains controls).

## [0.3.0] - 2026-06-20

### Added
- **Mobile / touch support** — phones & tablets get full on-screen controls (auto-detected
  via coarse pointer / touch):
  - Left-thumb virtual joystick to move (appears where you press).
  - Drag the right side of the screen to look around.
  - Buttons: 🔫 shoot (hold to auto-fire), 🔦 flashlight toggle, ⟳ reload, E interact
    (pulses gold at the door). While spectating, controls collapse to a single 👁
    switch-view button.
  - Tap-to-start screen (unlocks audio); no pointer-lock on mobile.
- Controller now accepts analog move input + touch look deltas; `Game` exposes a mobile
  `input` API (move / look / shoot / toggleFlashlight / reload / interact / cycleSpectate).

### Changed
- Renderer caps device pixel ratio to 1.5 on touch devices so hi-DPI phones don't choke.
- Desktop controls unchanged (WASD + mouse + pointer-lock).

## [0.2.0] - 2026-06-19

### Added
- **Co-op spectator mode** — when a player is caught, they no longer end the game. They
  become a spectator with a third-person follow-cam over a living teammate (press **Q** to
  switch survivor). The room (and crucially the host's simulation) keeps running.
- **Shared victory (team extract)** — when any survivor escapes through the front door, the
  whole room wins together.
- Spectator HUD: "YOU DIED — SPECTATING <name>" banner, survivor count; personal HUD
  (battery/ammo) hidden while dead.
- Per-player spawn offset so co-op survivors no longer stack on the exact same spot.
- Flashlight freeze rule now requires line-of-sight (a wall between you and the monster
  blocks the freeze).
- Favicon.

### Changed
- Death is now per-player (`{t:'death',id}`) instead of shared-fate. Game over only when
  every player is dead. A dead host keeps simulating + broadcasting snapshots, so survivors
  are never stranded.

### Fixed
- Co-op limbo bug: when the host died, survivors' monster/keys/door stopped syncing,
  leaving them in a dark, unwinnable state ("black screen, can't proceed").
- `requestPointerLock()` unhandled-rejection surfacing in the dev error overlay.

## [0.1.0] - 2026-06-19

### Added
- Initial release of **LMAO — Last Mortals Alive: Online**, a co-op browser horror survival
  shooter built with Next.js + React + Three.js.
- Multi-room procedural floor plan, camera-bound flashlight + battery economy, raycast
  weapon + ammo, freeze-rule monster AI, battery/ammo/brass-key pickups, lightning + synth
  thunder, jumpscare death + 3-key door-escape victory.
- Online co-op via WebRTC (PeerJS free broker, $0): host a room, share a 4-char code.
- All audio synthesized with the Web Audio API; all materials procedural (no external assets).
