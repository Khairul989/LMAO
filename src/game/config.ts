// All tunable game constants live here. One source of truth.

export const PLAYER = {
  speed: 5.4, // target horizontal speed (units/sec)
  accel: 42, // how fast we reach target velocity
  damping: 9, // velocity decay when no input
  radius: 0.45, // collision capsule radius
  eyeHeight: 1.7,
  sprintMul: 1.55,
  bobAmount: 0.045,
  bobSpeed: 9,
};

export const FLASHLIGHT = {
  maxBattery: 100,
  drainPerSec: 3.1, // % per second while ON
  coneAngleRad: Math.PI / 8, // spotlight cone half-angle
  penumbra: 0.55,
  intensity: 14,
  distance: 26,
  decay: 1.2,
  // freeze cone is a bit wider than the visible spot so aiming "near" works
  freezeAngleRad: Math.PI / 6.5,
};

export const FREEZE = {
  // cos of the half-cone; monster within this dot AND lit AND on => frozen
  dotThreshold: Math.cos(FLASHLIGHT.freezeAngleRad),
  maxRange: 24,
};

export const MONSTER = {
  speed: 3.0, // chase speed when unfrozen (slightly slower than player)
  accel: 6,
  hp: 100,
  contactDist: 1.15,
  damagePerHit: 100, // contact = instant kill (jumpscare)
  eyeColor: 0xff2b2b,
  height: 2.1,
  repathPerSec: 4,
};

export const AMMO = {
  start: 9,
  max: 9, // per "magazine"
  reserve: 18,
  boxRefill: 9,
  damagePerShot: 34, // ~3 shots to down
  fireCooldown: 0.28,
};

export const BATTERY = {
  count: 3,
  refillPct: 40,
};

export const KEYS = {
  count: 3,
};

export const WORLD = {
  wallHeight: 3.2,
  wallThickness: 0.3,
  roomCount: 5, // >= 4 distinct rooms
  ambient: 0.06, // base ambient light intensity
};

export const NET = {
  tickHz: 15,
  brokerPrefix: "LMAO",
};

export const LIGHTNING = {
  minGap: 7, // seconds
  maxGap: 22,
  flashIntensity: 2.4,
  flashDecay: 6, // how fast the flash fades
};

// --- Descend (roguelike floors) ---
// Each escaped floor drops you into a deeper, nastier one. Difficulty scales
// with level; the run ends on death and your score is how deep you got.
export const DESCEND = {
  ammoReward: 6, // reserve ammo granted on each descent
};

export interface LevelSpec {
  keys: number; // brass keys required to open the door
  monsters: number; // how many entities stalk this floor
  monsterSpeedMul: number; // chase-speed multiplier
  batteryDrainMul: number; // flashlight drains faster the deeper you go
  fogDensity: number; // exponential fog — the dark closes in
}

// Difficulty curve. Keys cap at 5 (only 5 non-foyer rooms); monsters cap at 4.
export function levelSpec(level: number): LevelSpec {
  const L = Math.max(1, level);
  return {
    keys: Math.min(2 + L, 5), // L1=3, L2=4, L3=5, …
    monsters: Math.min(1 + Math.floor((L - 1) / 2), 4), // L1=1,L2=1,L3=2,L5=3,L7=4
    monsterSpeedMul: Math.min(1 + (L - 1) * 0.1, 1.85), // up to +85% speed
    batteryDrainMul: Math.min(1 + (L - 1) * 0.08, 2.0), // up to 2× drain
    fogDensity: Math.min(0.012 + (L - 1) * 0.006, 0.06),
  };
}

export const config = {
  PLAYER,
  FLASHLIGHT,
  FREEZE,
  MONSTER,
  AMMO,
  BATTERY,
  KEYS,
  WORLD,
  NET,
  LIGHTNING,
};

export default config;
