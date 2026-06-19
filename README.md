# 🦉 LMAO — Last Mortals Alive: Online

> **The Temu™ League of Legends.** (LMAO is the cheap cousin of LoL.)
> A co-op first-person horror survival shooter that runs entirely in the browser.

You wake in a derelict house. Something hunts you in the dark — but it only moves
when you're **not** looking at it. Keep it pinned in your flashlight beam to freeze
it solid, ration your battery and ammo, find **3 brass keys**, and get back to the
front door alive. Play **solo**, or **host a room** and drag friends in with a
4-character code.

Built with **Next.js + React + Three.js**. Online play uses **WebRTC (PeerJS)** over
the free public broker — **zero paid infrastructure**, Vercel-free-tier deployable.

---

## Gameplay

| Action | Control |
|---|---|
| Move | `W` `A` `S` `D` (hold `Shift` to sprint) |
| Look | Mouse (click the canvas to capture the cursor, `Esc` to release) |
| Shoot | Left click |
| Flashlight on/off | `F` |
| Reload | `R` |
| Interact / Escape | `E` |

### The Flashlight Freeze Rule
The monster **freezes** whenever it's inside your flashlight cone **and the light is
on** (with line-of-sight — walls block the beam). Look away, run out of battery, or
let it slip out of the cone, and it **sprints straight at you**. One touch = death.

### Win / Lose
- **Win:** collect all 3 brass keys (hidden across the rooms), return to the front
  door, press `E` to escape.
- **Lose:** let it reach you → full-screen jumpscare → restart.

### Resources
- **Battery** drains continuously while the flashlight is on. 3 green battery pickups
  refill +40% each. At 0%, the light dies and the monster can't be frozen.
- **Ammo** is scarce. Shooting the monster damages/downs it temporarily. Cyan ammo
  boxes refill your reserve.

### Co-op
Host a room → share the code. Everyone shares one world: the same monster (frozen if
*any* survivor lights it), the same keys, the same storm. You can see each other's
avatars and flashlight beams. Battery/ammo are personal; keys are shared.

---

## Tech

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Three.js** — all geometry from primitives, all materials procedural shaders
  (value-noise injected into `MeshStandardMaterial`). **No external textures/images.**
- **Web Audio API** — every sound (thunder, gunshot, pickups, jumpscare, ambience) is
  synthesized live. **No audio files.**
- **Zustand** — HUD/UI state
- **PeerJS / WebRTC** — host/join rooms over the free public broker ($0)
- **Tailwind CSS** — portal, menus, HUD, screens

### Architecture
```
src/
  app/            portal (/) + game route (/play, client-only) + layout/icon
  components/     React shell: GameShell · Menu · Lobby · Hud · Screens · GameCanvas
  game/
    Game.ts       orchestrator: owns the RAF loop, freeze rule, net sync, win/lose
    engine/       renderer (scene/camera/WebGL)
    world/        floorplan (5 rooms + corridor) · procedural materials · lightning
    player/       pointer-lock controls + collision · camera-bound flashlight
    combat/       raycast weapon (muzzle flash, recoil, ammo)
    items/        battery / ammo / brass-key pickups
    monster/      mesh + chase AI + freeze rule + contact/damage
    audio/        AudioEngine (Web Audio synth)
    net/          NetManager (PeerJS host/join, snapshot sync)
    state/ rng/ config/ types
```
Host is authoritative for the monster, keys, door and storm; clients interpolate
host snapshots and send their own transforms + shot/pickup intents. Item placement is
seeded so every client builds an identical house.

See [`docs/plans/lmao-design.md`](docs/plans/lmao-design.md) for the full design + module contracts.

---

## Run it

> Uses **bun** (not npm/pnpm/yarn).

```bash
bun install
bun dev          # http://localhost:3000
```

Open the URL, hit **Play**, pick **Solo** or **Host**. For co-op, open a second
browser/device, choose **Join**, and enter the host's code.

```bash
bun run build    # production build
bun run typecheck
bun run lint
```

🎧 Best with headphones in a dark room. Good luck.
