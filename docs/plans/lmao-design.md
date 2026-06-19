# LMAO — "Last Mortals Alive: Online"

> The Temu™ version of League of Legends. (LMAO is the cheap cousin of LoL.)
> A co-op first-person horror survival shooter that runs in the browser.

## Concept

You wake in a derelict residence. A freeze-rule horror hunts you in the dark. Find
**3 Brass Keys** hidden across the rooms, survive on a draining flashlight battery
and scarce ammo, then return to the **Front Door** to escape. Play **solo** or
**co-op** by hosting a room and sharing a 4-char code (modern web-multiplayer UX).

The flashlight is the core mechanic: **keep the monster in your light cone and it
freezes**. Look away and it sprints at you.

## Hard constraints (from the brief)

- **Next.js + React** (App Router) — deployment model is fixed. Everything else free.
- **Online play via host rooms** — join by code, like modern web multiplayer.
- **$0 infrastructure** (cost policy): WebRTC via **PeerJS free public broker**
  (no account, no key, no server we pay for). No paid services. Vercel free-tier deployable.
- **bun only** for all package management (NEVER npm/pnpm/yarn).
- Procedural everything: Three.js geometric primitives + procedural shader materials
  (no external textures/images), all audio synthesized with the **Web Audio API**.

## Tech stack

- Next.js 15 (App Router, TypeScript, `"use client"` for game) + Tailwind CSS v3
- three (npm) — WebGLRenderer, PointerLockControls (from `three/examples/jsm`)
- zustand — HUD/UI state store
- peerjs — WebRTC host/join over the free cloud broker
- Web Audio API — all SFX/ambience synthesized at runtime

## Deterministic placement

Item & key positions are derived from a **seed** (mulberry32 PRNG). Host generates
the seed and broadcasts it on room init so every client builds an identical world.
Solo mode uses a local seed.

---

## File layout & module contracts (FROZEN — implement to these exact signatures)

```
temu-lol/
  package.json  next.config.mjs  tsconfig.json  tailwind.config.ts  postcss.config.mjs
  src/
    app/
      layout.tsx        # root layout, Tailwind globals, dark bg
      globals.css       # tailwind directives + base styles
      page.tsx          # landing / portal (branded) -> links into <Menu/>
      play/page.tsx     # client-only game route: mounts <GameShell/>
    components/
      GameShell.tsx     # top-level client state machine: menu|lobby|loading|playing|dead|victory
      Menu.tsx          # mode select: Solo / Host / Join
      Lobby.tsx         # host: show code + player list + Start; join: enter code + waiting
      Hud.tsx           # in-game overlay: battery, ammo, keys, health, crosshair, toast, prompts
      Screens.tsx       # DeathScreen (jumpscare), VictoryScreen, LoadingScreen
      GameCanvas.tsx    # mounts Game engine to a <canvas>, owns its lifecycle + pointerlock
    game/
      types.ts          # ALL shared types/interfaces
      config.ts         # ALL tunable constants + level layout data
      rng.ts            # mulberry32 seeded PRNG + helpers
      state/store.ts    # zustand store (HUD state + actions)
      audio/audio.ts    # AudioEngine singleton (Web Audio synth)
      engine/renderer.ts# RendererBundle: scene/camera/renderer/loop/dispose
      world/materials.ts# procedural ShaderMaterials
      world/floorplan.ts# buildWorld(scene,cfg,rng) -> WorldData
      world/lighting.ts # LightingSystem: ambient + lightning flashes (+ thunder via audio)
      player/controls.ts# PlayerController: pointerlock+WASD+damping+collision
      player/flashlight.ts # Flashlight: camera-bound SpotLight + battery + cone test
      combat/weapon.ts  # Weapon: viewport gun mesh + raycast shoot + muzzle flash
      items/pickups.ts  # Pickups: batteries, ammo boxes, brass keys + AABB collection
      monster/monster.ts# Monster: mesh + AI pathing + freeze rule + contact/damage
      net/net.ts        # NetManager: PeerJS host/join, room codes, state sync
      Game.ts           # Game orchestrator: ties everything, owns update loop, writes store
```

### `game/types.ts` (authored in scaffold; everyone imports from here)

```ts
import * as THREE from 'three'

export type Phase = 'menu' | 'lobby' | 'loading' | 'playing' | 'dead' | 'victory'
export type Mode = 'solo' | 'host' | 'join'

export interface HudState {
  battery: number        // 0..100
  flashlightOn: boolean
  ammo: number
  maxAmmo: number
  reserveAmmo: number
  keysFound: number      // 0..3
  health: number         // 0..100
  monsterFrozen: boolean
  toast: string          // transient message
  prompt: string         // contextual e.g. "Press E to escape"
  nearDoor: boolean
  remotePlayers: number
  fps: number
}

export interface WorldData {
  colliders: THREE.Box3[]     // wall AABBs for player/monster collision
  spawn: THREE.Vector3        // player start (near front door, inside)
  frontDoor: THREE.Vector3    // escape target
  doorBox: THREE.Box3         // trigger volume at the door
  roomCenters: THREE.Vector3[]// candidate placement points for items/keys
  bounds: THREE.Box3          // overall floor extents
  dispose(): void
}

export interface RemoteState {       // per-peer transform broadcast
  id: string
  x: number; y: number; z: number
  ry: number                          // yaw
  flashlightOn: boolean
}

export interface NetSnapshot {       // host -> clients, ~15Hz
  seed: number
  monster: { x: number; y: number; z: number; frozen: boolean; alive: boolean }
  keys: boolean[]                     // collected flags by index
  doorOpen: boolean
  lightning: boolean                  // flash pulse this tick
}

export type NetEvent =
  | { t: 'hello'; id: string; name: string }
  | { t: 'state'; s: RemoteState }      // client -> host (and rebroadcast)
  | { t: 'shoot'; ox: number; oy: number; oz: number; dx: number; dy: number; dz: number }
  | { t: 'snapshot'; s: NetSnapshot }   // host -> clients
  | { t: 'start'; seed: number }
  | { t: 'hit'; dmg: number }           // host -> a client (monster caught you)

export interface ModuleUpdate { (dt: number, now: number): void }
```

### `game/config.ts` — constants (single source; tune freely but keep names)

`PLAYER.speed, accel, damping, radius, eyeHeight; FLASHLIGHT.maxBattery, drainPerSec,
coneAngleRad, penumbra, intensity, distance; FREEZE.dotThreshold (cos of half-cone);
MONSTER.speed, accelToPlayer, hp, contactDist, stunOnHitSec; AMMO.start, max, reserve,
boxRefill, damagePerShot; BATTERY.count, refillPct; KEYS.count(=3);
WORLD.roomCount(>=4), wallHeight, etc.; NET.tickHz, brokerPrefix='LMAO'.`

### `game/state/store.ts` — zustand

```ts
export interface GameStore extends HudState {
  phase: Phase
  mode: Mode
  roomCode: string
  set: (p: Partial<HudState>) => void
  setPhase: (p: Phase) => void
  reset: () => void
}
```

### `game/engine/renderer.ts`

```ts
export interface RendererBundle {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  onResize(): void
  dispose(): void
}
export function createRenderer(canvas: HTMLCanvasElement): RendererBundle
```

### `game/world/floorplan.ts`

```ts
export function buildWorld(scene: THREE.Scene, rng: () => number): WorldData
```
- ≥4 distinct rooms + connecting corridors. Walls, floor, ceiling as boxes/planes with
  procedural materials from `materials.ts`. Push every wall into `colliders` as `Box3`.
  Pick `spawn` just inside the front door; `frontDoor`/`doorBox` at the entrance.
  `roomCenters` = one point per room for item/key scatter.

### `game/world/materials.ts`

```ts
export function wallMaterial(): THREE.Material   // procedural plaster/concrete (ShaderMaterial)
export function floorMaterial(): THREE.Material  // procedural boards/tile
export function ceilingMaterial(): THREE.Material
```
Use `ShaderMaterial` w/ value-noise GLSL. No textures. Must react to scene lights OR
fake simple lambert in-shader using the flashlight uniform-less approach (keep emissive
low so the flashlight reveal works — prefer `MeshStandardMaterial` w/ onBeforeCompile
noise injection if simpler & still light-reactive). Dark, grimy palette.

### `game/world/lighting.ts`

```ts
export interface LightingSystem extends ModuleUpdate {
  flashNow(): void        // trigger a lightning pulse (host broadcasts)
  dispose(): void
}
export function createLighting(scene: THREE.Scene, audio: AudioEngine): LightingSystem
```
Very low ambient. Randomly (Poisson-ish) trigger brief intense flashes + call
`audio.thunder()`. Expose `flashNow()` so the host can sync flashes to clients.

### `game/player/controls.ts`

```ts
export interface PlayerController extends ModuleUpdate {
  object: THREE.Object3D       // the yaw object holding the camera
  velocity: THREE.Vector3
  lock(): void; unlock(): void
  isLocked(): boolean
  setColliders(boxes: THREE.Box3[]): void
  teleport(v: THREE.Vector3): void
  dispose(): void
}
export function createController(camera: THREE.PerspectiveCamera, dom: HTMLElement): PlayerController
```
PointerLockControls-style yaw/pitch on mouse; WASD → desired velocity; smooth accel +
damping (config). Resolve collisions vs `colliders` per-axis using player `radius` so you
never clip walls. Clamp dt. Clean up listeners in `dispose`.

### `game/player/flashlight.ts`

```ts
export interface Flashlight extends ModuleUpdate {
  spot: THREE.SpotLight
  on: boolean
  battery: number             // 0..100
  toggle(): void
  addBattery(pct: number): void
  // true if `worldPoint` lies within the lit cone AND light is on (for freeze rule)
  illuminates(camera: THREE.Camera, worldPoint: THREE.Vector3): boolean
  dispose(): void
}
export function createFlashlight(camera: THREE.PerspectiveCamera): Flashlight
```
Tight `angle`, high `penumbra`, parented to camera so it tracks the matrix. Battery
drains while on; at 0 it forces off. `illuminates` uses dot(forward, toMonster) >=
cos(coneAngle) AND distance <= range AND `on`.

### `game/combat/weapon.ts`

```ts
export interface Weapon extends ModuleUpdate {
  group: THREE.Group          // viewport gun, added to camera, lower-right
  ammo: number; reserve: number
  tryShoot(targets: THREE.Object3D[]): { hit: THREE.Object3D | null; origin: THREE.Vector3; dir: THREE.Vector3 } | null
  reload(): void
  addAmmo(n: number): void
  dispose(): void
}
export function createWeapon(camera: THREE.PerspectiveCamera, audio: AudioEngine): Weapon
```
Primitive gun locked lower-right of view. Left-click → raycast from screen center; muzzle
flash (brief PointLight) + `audio.gunshot()` + recoil kick. Returns hit so Game applies
monster damage. No ammo → click = dry sound.

### `game/items/pickups.ts`

```ts
export interface Pickups extends ModuleUpdate {
  group: THREE.Group
  // call each frame with player position; returns events to apply
  collect(playerPos: THREE.Vector3): Array<
    | { kind: 'battery' } | { kind: 'ammo'; n: number } | { kind: 'key'; index: number }>
  keyState(): boolean[]
  setKeyState(s: boolean[]): void
  dispose(): void
}
export function createPickups(scene: THREE.Scene, world: WorldData, rng: () => number, audio: AudioEngine): Pickups
```
3 glowing battery cylinders, N ammo boxes, 3 golden brass keys (spheres/torus) scattered
via `world.roomCenters` + rng. AABB collection. Battery→+40%, key→inventory, ammo→refill.
Keys can be synced via `setKeyState` (co-op).

### `game/monster/monster.ts`

```ts
export interface Monster extends ModuleUpdate {
  mesh: THREE.Object3D
  hp: number; frozen: boolean; alive: boolean
  setTarget(p: THREE.Vector3): void          // nearest player position
  setFreeze(frozen: boolean): void
  damage(n: number): void
  contacts(playerPos: THREE.Vector3): boolean
  // host-authoritative transform for sync:
  getState(): { x:number;y:number;z:number;frozen:boolean;alive:boolean }
  setState(s: { x:number;y:number;z:number;frozen:boolean;alive:boolean }): void
  dispose(): void
}
export function createMonster(scene: THREE.Scene, world: WorldData, audio: AudioEngine): Monster
```
Distinct creepy mesh (stacked primitives, emissive eyes). Paths toward target on XZ,
collides w/ walls. **Freeze rule**: when `frozen` velocity=0 (Game sets freeze from
flashlight cone test). Otherwise accelerates at player. `contacts` → Game triggers death.
Shots reduce hp; at 0 → `alive=false`, despawn.

### `game/audio/audio.ts`

```ts
export class AudioEngine {
  constructor()
  resume(): void                 // call on first user gesture
  thunder(): void
  gunshot(): void
  dryFire(): void
  chirp(): void                  // battery pickup
  keyPickup(): void
  ammoPickup(): void
  jumpscare(): void              // low-freq noise burst
  startAmbience(): void; stopAmbience(): void
  footstep(): void
  dispose(): void
}
```
All synthesized (oscillators, noise buffers, filters, envelopes). Guard against
autoplay-block: only build/resume context after a user gesture.

### `game/net/net.ts`

```ts
export interface NetCallbacks {
  onPlayerJoin(id: string): void
  onPlayerLeave(id: string): void
  onRemoteState(s: RemoteState): void
  onSnapshot(s: NetSnapshot): void          // client receives host authority
  onShoot(ox:number,oy:number,oz:number,dx:number,dy:number,dz:number, from:string): void
  onStart(seed: number): void
  onHit(dmg: number): void
}
export interface NetManager {
  mode: Mode
  selfId: string
  roomCode: string
  peers(): string[]
  host(cb: NetCallbacks): Promise<string>   // resolves with room code
  join(code: string, cb: NetCallbacks): Promise<void>
  startSolo(): void
  sendState(s: RemoteState): void           // client/host -> host fanout
  sendShoot(ox:number,oy:number,oz:number,dx:number,dy:number,dz:number): void
  broadcastSnapshot(s: NetSnapshot): void    // host only
  sendStart(seed: number): void              // host only
  isHost(): boolean
  dispose(): void
}
export function createNet(): NetManager
```
PeerJS default cloud broker. Host peer id = `LMAO-` + 4 random chars (room code is the 4
chars). Clients connect to `LMAO-<CODE>`. Host relays/authoritative; clients send
transforms + shoot intents; host broadcasts snapshots. Solo = no peer, all callbacks
local no-ops. Robust error handling (broker unreachable → surface error to UI, fall back
to solo gracefully).

### `game/Game.ts` — orchestrator (owned by scaffold + integration; feature agents DO NOT edit)

```ts
export interface GameOptions { mode: Mode; net: NetManager; seed: number }
export interface GameHandle { start(): void; dispose(): void }
export function createGame(canvas: HTMLCanvasElement, opts: GameOptions): GameHandle
```
Wires renderer→world→player→flashlight→weapon→monster→pickups→lighting→audio→net.
Owns the RAF loop: clamp dt; update controller, flashlight (drain), weapon, pickups,
monster (host AI; client lerps to snapshot), lighting; run **freeze rule** each frame
(`flashlight.illuminates(camera, monster pos)` → `monster.setFreeze`); apply pickups;
detect monster contact → `store.setPhase('dead')` + `audio.jumpscare()`; detect all keys
+ at door + interact → `victory`. Throttle store writes (~10Hz) + push HUD. Host
broadcasts snapshots at `NET.tickHz`; everyone sends own transform. Full `dispose`.

---

## React/UI behavior

- **`page.tsx`** (portal): branded landing — neon "LMAO" wordmark, tagline "The Temu™
  League of Legends", feature blurbs, a big **PLAY** button → `/play`. Tailwind, dark,
  horror-neon aesthetic, animated. Note "best with sound + headphones".
- **`play/page.tsx`**: dynamic import of `GameShell` with `ssr:false`.
- **`GameShell.tsx`**: drives `phase`. menu→Menu; lobby→Lobby; loading/playing→GameCanvas
  (+ Hud); dead→DeathScreen; victory→VictoryScreen. Holds the single `NetManager` +
  `GameHandle`. Resumes AudioEngine on first gesture.
- **`Menu.tsx`**: Solo / Host / Join. Join shows a 4-char code input. Controls legend
  (WASD move, mouse look, click shoot, F flashlight, R reload, E interact).
- **`Lobby.tsx`**: host shows big room code to share + live player list + Start (broadcasts
  seed → all go loading→playing). Join shows "waiting for host…".
- **`Hud.tsx`**: battery bar (color shifts green→red as it drains, pulse when low), ammo
  `cur / reserve`, "Keys Found: X/3" with 3 key pips, health bar, center crosshair,
  "FROZEN" indicator when monster frozen, toast messages, door prompt, remote-player count.
- **`Screens.tsx`**: DeathScreen = full-screen blood-red jumpscare overlay + glitch + a
  "Restart" button (full state reset). VictoryScreen = clean "YOU ESCAPED" + stats +
  "Play Again". LoadingScreen = themed spinner.

## Game loop rules (must hold)

- dt clamped to ≤ 0.05s. All per-frame math guarded against NaN.
- Pointer lock acquired on canvas click; ESC releases (pauses look).
- Battery drains only while on; 0 → auto-off, monster un-freezable → tension.
- Freeze rule recomputed every frame for the nearest monster.
- Host authoritative for monster/keys/door/lightning; clients interpolate snapshots.
- Every module exposes `dispose()`; Game calls them all. No leaked RAF / listeners /
  AudioContext / WebGL contexts on unmount or restart.

## Proving commands

- `bun install`
- `bun run typecheck`  (`tsc --noEmit`) — must pass.
- `bun run lint`       (`next lint`) — must pass (warnings ok).
- `bun run build`      (`next build`) — must succeed.
- Manual smoke: `bun dev` → load `/`, click PLAY → Solo → game renders, can move/look,
  flashlight freezes monster, shoot works, pick up battery/ammo/keys, die → restart,
  collect 3 keys + return to door → victory. Host→code shown; second tab Join→code connects.
```
