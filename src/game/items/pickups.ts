import * as THREE from "three";
import { AMMO, BATTERY, KEYS } from "@/game/config";
import type { AudioEngine } from "@/game/audio/audio";
import { range, shuffle } from "@/game/rng";
import type { ModuleUpdate, WorldData } from "@/game/types";

type PickupKind = "battery" | "ammo" | "key";

interface Item {
  kind: PickupKind;
  index: number; // key index (0..2) or item ordinal
  mesh: THREE.Object3D;
  light?: THREE.PointLight;
  collected: boolean;
  baseY: number;
}

export type CollectEvent =
  | { kind: "battery" }
  | { kind: "ammo"; n: number }
  | { kind: "key"; index: number };

export interface Pickups extends ModuleUpdate {
  group: THREE.Group;
  collect(playerPos: THREE.Vector3): CollectEvent[];
  keyState(): boolean[];
  setKeyState(s: boolean[]): void;
  keyPositions(): THREE.Vector3[];
  dispose(): void;
}

const PICK_RADIUS = 1.05;

export function createPickups(
  scene: THREE.Scene,
  world: WorldData,
  rng: () => number,
  audio: AudioEngine,
): Pickups {
  const group = new THREE.Group();
  group.name = "pickups";
  scene.add(group);

  const items: Item[] = [];
  const disposables: (THREE.Material | THREE.BufferGeometry)[] = [];

  // Candidate rooms (skip foyer index 0 for keys to make them a hunt).
  const rooms = world.roomCenters;
  const keyRooms = shuffle(rng, rooms.slice(1)).slice(0, KEYS.count);
  const batteryRooms = shuffle(rng, rooms).slice(0, BATTERY.count);
  const ammoRooms = shuffle(rng, rooms).slice(0, 3);

  function jitter(base: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      base.x + range(rng, -2.2, 2.2),
      0,
      base.z + range(rng, -2.2, 2.2),
    );
  }

  // --- Brass keys: glowing golden torus knots ---
  const keyGeo = new THREE.TorusKnotGeometry(0.18, 0.06, 64, 8);
  disposables.push(keyGeo);
  keyRooms.forEach((room, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd8a93a,
      emissive: 0xffb820,
      emissiveIntensity: 0.9,
      metalness: 1,
      roughness: 0.25,
    });
    disposables.push(mat);
    const mesh = new THREE.Mesh(keyGeo, mat);
    const p = jitter(room);
    mesh.position.set(p.x, 1.0, p.z);
    const light = new THREE.PointLight(0xffc23a, 1.1, 5, 2);
    light.position.copy(mesh.position);
    group.add(mesh, light);
    items.push({ kind: "key", index: i, mesh, light, collected: false, baseY: 1.0 });
  });

  // --- Batteries: glowing green cylinders ---
  const batGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 12);
  disposables.push(batGeo);
  batteryRooms.forEach((room, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2f6,
      emissive: 0x33ff77,
      emissiveIntensity: 0.8,
      metalness: 0.6,
      roughness: 0.3,
    });
    disposables.push(mat);
    const mesh = new THREE.Mesh(batGeo, mat);
    const p = jitter(room);
    mesh.position.set(p.x, 0.5, p.z);
    const light = new THREE.PointLight(0x33ff77, 0.7, 4, 2);
    light.position.copy(mesh.position);
    group.add(mesh, light);
    items.push({ kind: "battery", index: i, mesh, light, collected: false, baseY: 0.5 });
  });

  // --- Ammo boxes: small cyan crates ---
  const ammoGeo = new THREE.BoxGeometry(0.32, 0.22, 0.24);
  disposables.push(ammoGeo);
  ammoRooms.forEach((room, i) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x14555f,
      emissive: 0x18c0d8,
      emissiveIntensity: 0.5,
      metalness: 0.4,
      roughness: 0.5,
    });
    disposables.push(mat);
    const mesh = new THREE.Mesh(ammoGeo, mat);
    const p = jitter(room);
    mesh.position.set(p.x, 0.35, p.z);
    group.add(mesh);
    items.push({ kind: "ammo", index: i, mesh, collected: false, baseY: 0.35 });
  });

  let t = 0;
  const pk: Pickups = ((dt: number) => {
    t += dt;
    for (const it of items) {
      if (it.collected) continue;
      it.mesh.rotation.y += dt * (it.kind === "key" ? 1.6 : 0.8);
      it.mesh.position.y = it.baseY + Math.sin(t * 2 + it.index) * 0.08;
    }
  }) as unknown as Pickups;

  pk.group = group;

  pk.collect = (playerPos) => {
    const events: CollectEvent[] = [];
    for (const it of items) {
      if (it.collected) continue;
      const dx = it.mesh.position.x - playerPos.x;
      const dz = it.mesh.position.z - playerPos.z;
      if (dx * dx + dz * dz <= PICK_RADIUS * PICK_RADIUS) {
        it.collected = true;
        it.mesh.visible = false;
        if (it.light) it.light.visible = false;
        if (it.kind === "battery") {
          audio.chirp();
          events.push({ kind: "battery" });
        } else if (it.kind === "ammo") {
          audio.ammoPickup();
          events.push({ kind: "ammo", n: AMMO.boxRefill });
        } else {
          audio.keyPickup();
          events.push({ kind: "key", index: it.index });
        }
      }
    }
    return events;
  };

  pk.keyState = () => {
    const s = [false, false, false];
    for (const it of items) {
      if (it.kind === "key") s[it.index] = it.collected;
    }
    return s;
  };

  pk.setKeyState = (s) => {
    for (const it of items) {
      if (it.kind === "key" && s[it.index] && !it.collected) {
        it.collected = true;
        it.mesh.visible = false;
        if (it.light) it.light.visible = false;
      }
    }
  };

  pk.keyPositions = () =>
    items.filter((it) => it.kind === "key").map((it) => it.mesh.position.clone());

  pk.dispose = () => {
    scene.remove(group);
    disposables.forEach((d) => d.dispose());
    items.forEach((it) => it.light?.dispose());
  };

  return pk;
}
