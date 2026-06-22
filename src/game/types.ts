import * as THREE from "three";

export type Phase = "menu" | "lobby" | "loading" | "playing" | "dead" | "victory";
export type Mode = "solo" | "host" | "join";

export interface HudState {
  battery: number; // 0..100
  flashlightOn: boolean;
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  keysFound: number; // 0..3
  health: number; // 0..100
  level: number; // current floor depth (1-based)
  monsterFrozen: boolean;
  toast: string; // transient message
  prompt: string; // contextual e.g. "Press E to escape"
  nearDoor: boolean;
  remotePlayers: number;
  fps: number;
  spectating: boolean; // local player dead but watching a living teammate
  spectateName: string; // who we're watching
}

export interface WorldData {
  colliders: THREE.Box3[]; // wall AABBs for player/monster collision
  spawn: THREE.Vector3; // player start (near front door, inside)
  frontDoor: THREE.Vector3; // escape target
  doorBox: THREE.Box3; // trigger volume at the door
  roomCenters: THREE.Vector3[]; // candidate placement points for items/keys
  bounds: THREE.Box3; // overall floor extents
  dispose(): void;
}

export interface RemoteState {
  id: string;
  x: number;
  y: number;
  z: number;
  ry: number; // yaw
  flashlightOn: boolean;
  lit: number; // bitmask: which monsters this player is illuminating (freeze-rule input)
}

export type PickupKindNet = "battery" | "ammo" | "key";

export interface MonsterNetState {
  x: number;
  y: number;
  z: number;
  frozen: boolean;
  alive: boolean;
}

export interface NetSnapshot {
  seed: number;
  level: number; // floor the host is simulating (clients resync if behind)
  monsters: MonsterNetState[];
  keys: boolean[]; // collected flags by index
  doorOpen: boolean;
  lightning: boolean; // flash pulse this tick
}

export type NetEvent =
  | { t: "hello"; id: string; name: string }
  | { t: "state"; s: RemoteState }
  | { t: "shoot"; ox: number; oy: number; oz: number; dx: number; dy: number; dz: number }
  | { t: "snapshot"; s: NetSnapshot }
  | { t: "start"; seed: number }
  | { t: "pickup"; kind: PickupKindNet; index: number }
  | { t: "death"; id: string }
  | { t: "win" }
  | { t: "escape" } // client reached the door -> requests the host descend the room
  | { t: "descend"; level: number } // host -> all: drop to the next floor
  | { t: "hit"; dmg: number };

export interface ModuleUpdate {
  (dt: number, now: number): void;
}
