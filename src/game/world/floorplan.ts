import * as THREE from "three";
import { WORLD } from "@/game/config";
import type { WorldData } from "@/game/types";
import {
  ceilingMaterial,
  doorMaterial,
  floorMaterial,
  wallMaterial,
} from "@/game/world/materials";

// Building footprint: x in [-10,10], z in [0,24]. Front door on the south (z=24).
const X0 = -10;
const X1 = 10;
const Z0 = 0;
const Z1 = 24;
const H = WORLD.wallHeight;
const T = WORLD.wallThickness;

type Gap = [number, number]; // [start, end] along the wall axis to leave open

export function buildWorld(scene: THREE.Scene, _rng: () => number): WorldData {
  const group = new THREE.Group();
  group.name = "world";
  scene.add(group);

  const colliders: THREE.Box3[] = [];
  const wallMat = wallMaterial();
  const disposables: THREE.Material[] = [wallMat];

  // Build an axis-aligned wall from (ax,az) to (bx,bz), leaving `gaps` open.
  function wall(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    gaps: Gap[] = [],
    mat: THREE.Material = wallMat,
  ) {
    const alongX = az === bz;
    const start = alongX ? Math.min(ax, bx) : Math.min(az, bz);
    const end = alongX ? Math.max(ax, bx) : Math.max(az, bz);

    // Split [start,end] into solid sub-segments by subtracting the gaps.
    const sorted = gaps
      .map((g) => [Math.min(g[0], g[1]), Math.max(g[0], g[1])] as Gap)
      .sort((a, b) => a[0] - b[0]);
    let cursor = start;
    const segments: Gap[] = [];
    for (const [gs, ge] of sorted) {
      if (gs > cursor) segments.push([cursor, Math.min(gs, end)]);
      cursor = Math.max(cursor, ge);
    }
    if (cursor < end) segments.push([cursor, end]);

    for (const [s, e] of segments) {
      const len = e - s;
      if (len <= 0.001) continue;
      const w = alongX ? len : T;
      const d = alongX ? T : len;
      const cx = alongX ? s + len / 2 : ax;
      const cz = alongX ? az : s + len / 2;
      const geo = new THREE.BoxGeometry(w, H, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(cx, H / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(cx, H / 2, cz),
        new THREE.Vector3(w, H, d),
      );
      colliders.push(box);
    }
  }

  // --- Floor ---
  const floorGeo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, 1, 1);
  const floorMat = floorMaterial();
  disposables.push(floorMat);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  floor.receiveShadow = true;
  group.add(floor);

  // --- Ceiling ---
  const ceilGeo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, 1, 1);
  const ceilMat = ceilingMaterial();
  disposables.push(ceilMat);
  const ceiling = new THREE.Mesh(ceilGeo, ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set((X0 + X1) / 2, H, (Z0 + Z1) / 2);
  ceiling.receiveShadow = true;
  group.add(ceiling);

  // --- Outer perimeter ---
  const doorGap: Gap = [-1.6, 1.6];
  wall(X0, Z1, X1, Z1, [doorGap]); // south wall with front door gap
  wall(X0, Z0, X1, Z0); // north wall (solid)
  wall(X0, Z0, X0, Z1); // west wall
  wall(X1, Z0, X1, Z1); // east wall

  // --- Foyer divider at z=18 (gap = corridor mouth) ---
  wall(X0, 18, X1, 18, [[-2, 2]]);

  // --- Corridor walls (x = -2 and x = 2), z 0..18, with room doorways ---
  // Left corridor wall: doorway to Room A (z 13..16) + Room B (z 4..7)
  wall(-2, Z0, -2, 18, [
    [13, 16],
    [4, 7],
  ]);
  // Right corridor wall: doorway to Room C + Room D
  wall(2, Z0, 2, 18, [
    [13, 16],
    [4, 7],
  ]);

  // --- Side partition walls between front/back rooms (z=10) ---
  wall(X0, 10, -2, 10); // left side A|B divider (solid)
  wall(2, 10, X1, 10); // right side C|D divider (solid)

  // --- Front door (decorative mesh in the gap) ---
  const dMat = doorMaterial();
  disposables.push(dMat);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(3.0, H - 0.2, 0.18), dMat);
  doorMesh.position.set(0, (H - 0.2) / 2, Z1 - 0.05);
  doorMesh.name = "frontDoor";
  group.add(doorMesh);

  // Door trigger volume (just inside the door).
  const doorBox = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(0, H / 2, Z1 - 1.4),
    new THREE.Vector3(4, H, 2.8),
  );

  const spawn = new THREE.Vector3(0, 0, 21.5);
  const frontDoor = new THREE.Vector3(0, 0, Z1 - 0.6);

  const roomCenters = [
    new THREE.Vector3(0, 0, 21), // foyer
    new THREE.Vector3(-6, 0, 14), // Room A
    new THREE.Vector3(-6, 0, 5), // Room B
    new THREE.Vector3(6, 0, 14), // Room C
    new THREE.Vector3(6, 0, 5), // Room D
    new THREE.Vector3(0, 0, 9), // corridor mid
  ];

  const bounds = new THREE.Box3(
    new THREE.Vector3(X0, 0, Z0),
    new THREE.Vector3(X1, H, Z1),
  );

  return {
    colliders,
    spawn,
    frontDoor,
    doorBox,
    roomCenters,
    bounds,
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      disposables.forEach((m) => m.dispose());
    },
  };
}
