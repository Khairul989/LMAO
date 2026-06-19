import * as THREE from "three";
import { MONSTER, PLAYER } from "@/game/config";
import type { AudioEngine } from "@/game/audio/audio";
import type { ModuleUpdate, MonsterNetState, WorldData } from "@/game/types";

export interface Monster extends ModuleUpdate {
  mesh: THREE.Object3D;
  hitGroup: THREE.Object3D; // pass to weapon raycast targets
  hp: number;
  frozen: boolean;
  alive: boolean;
  aiEnabled: boolean; // host runs AI; clients follow snapshots
  setTarget(p: THREE.Vector3): void;
  setFreeze(frozen: boolean): void;
  damage(n: number): void;
  contacts(playerPos: THREE.Vector3): boolean;
  getState(): MonsterNetState;
  setState(s: MonsterNetState): void;
  position(): THREE.Vector3;
  dispose(): void;
}

const RADIUS = 0.5;

export function createMonster(
  scene: THREE.Scene,
  world: WorldData,
  audio: AudioEngine,
): Monster {
  const root = new THREE.Group();
  root.name = "monster";

  // --- Creepy figure from primitives ---
  const skin = new THREE.MeshStandardMaterial({
    color: 0x0c0c10,
    roughness: 0.9,
    metalness: 0.1,
    emissive: 0x070708,
  });
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 1.0, 6, 12),
    skin,
  );
  torso.position.y = 1.1;
  torso.scale.set(1, 1.1, 0.8);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 16), skin);
  head.position.y = MONSTER.height - 0.2;
  head.scale.set(1, 1.25, 1);

  const eyeMat = new THREE.MeshBasicMaterial({ color: MONSTER.eyeColor });
  const eyeGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-0.12, MONSTER.height - 0.18, 0.28);
  eyeR.position.set(0.12, MONSTER.height - 0.18, 0.28);

  // long spindly arms
  const armGeo = new THREE.CapsuleGeometry(0.1, 1.1, 4, 8);
  const armL = new THREE.Mesh(armGeo, skin);
  const armR = new THREE.Mesh(armGeo, skin);
  armL.position.set(-0.5, 1.0, 0);
  armR.position.set(0.5, 1.0, 0);

  const glow = new THREE.PointLight(MONSTER.eyeColor, 0.6, 4, 2);
  glow.position.set(0, MONSTER.height - 0.18, 0.3);

  root.add(torso, head, eyeL, eyeR, armL, armR, glow);
  root.castShadow = true;
  torso.castShadow = true;
  head.castShadow = true;

  // spawn far from the player (north end), pick a back room
  const spawnPts = [
    new THREE.Vector3(-6, 0, 3),
    new THREE.Vector3(6, 0, 3),
    new THREE.Vector3(0, 0, 2),
  ];
  const sp = spawnPts[Math.floor(Math.random() * spawnPts.length)];
  root.position.set(sp.x, 0, sp.z);
  scene.add(root);

  const target = new THREE.Vector3(sp.x, 0, sp.z);
  const velocity = new THREE.Vector3();
  let growlTimer = 0;
  let swayT = 0;

  const mn: Monster = ((dt: number) => {
    if (!mn.alive) return;
    swayT += dt;

    if (!mn.frozen) {
      if (mn.aiEnabled) {
        // accelerate toward target on XZ
        const dx = target.x - root.position.x;
        const dz = target.z - root.position.z;
        const len = Math.hypot(dx, dz) || 1;
        const desiredX = (dx / len) * MONSTER.speed;
        const desiredZ = (dz / len) * MONSTER.speed;
        velocity.x += (desiredX - velocity.x) * Math.min(1, MONSTER.accel * dt);
        velocity.z += (desiredZ - velocity.z) * Math.min(1, MONSTER.accel * dt);

        // face movement direction
        if (Math.hypot(velocity.x, velocity.z) > 0.05) {
          root.rotation.y = Math.atan2(velocity.x, velocity.z);
        }

        // integrate + collide with walls (per-axis)
        const pos = root.position;
        pos.x += velocity.x * dt;
        for (const b of world.colliders) {
          if (
            pos.x + RADIUS > b.min.x &&
            pos.x - RADIUS < b.max.x &&
            pos.z + RADIUS > b.min.z &&
            pos.z - RADIUS < b.max.z
          ) {
            if (velocity.x > 0) pos.x = b.min.x - RADIUS;
            else if (velocity.x < 0) pos.x = b.max.x + RADIUS;
            velocity.x = 0;
          }
        }
        pos.z += velocity.z * dt;
        for (const b of world.colliders) {
          if (
            pos.x + RADIUS > b.min.x &&
            pos.x - RADIUS < b.max.x &&
            pos.z + RADIUS > b.min.z &&
            pos.z - RADIUS < b.max.z
          ) {
            if (velocity.z > 0) pos.z = b.min.z - RADIUS;
            else if (velocity.z < 0) pos.z = b.max.z + RADIUS;
            velocity.z = 0;
          }
        }
      }

      // menacing sway + arm reach (runs on host AND client for atmosphere)
      torso.rotation.z = Math.sin(swayT * 4) * 0.08;
      armL.rotation.x = Math.sin(swayT * 5) * 0.6 - 0.3;
      armR.rotation.x = -Math.sin(swayT * 5) * 0.6 - 0.3;
      eyeMat.color.setHex(MONSTER.eyeColor);
      glow.color.setHex(MONSTER.eyeColor);
      glow.intensity = 0.6;

      growlTimer -= dt;
      if (growlTimer <= 0) {
        growlTimer = 2.5 + Math.random() * 2.5;
        audio.footstep();
      }
    } else {
      // FROZEN: tremble, eyes go cold, no movement
      velocity.set(0, 0, 0);
      const tremor = Math.sin(performance.now() * 0.05) * 0.015;
      root.position.x += tremor;
      eyeMat.color.setHex(0x6fb7ff);
      glow.color.setHex(0x6fb7ff);
      glow.intensity = 0.35;
    }
  }) as unknown as Monster;

  mn.mesh = root;
  mn.hitGroup = root;
  mn.hp = MONSTER.hp;
  mn.frozen = false;
  mn.alive = true;
  mn.aiEnabled = true;

  mn.setTarget = (p) => {
    target.set(p.x, 0, p.z);
  };
  mn.setFreeze = (f) => {
    mn.frozen = f;
  };
  mn.damage = (n) => {
    if (!mn.alive) return;
    mn.hp -= n;
    // brief hit flash
    eyeMat.color.setHex(0xffffff);
    if (mn.hp <= 0) {
      mn.hp = 0;
      mn.alive = false;
      root.visible = false;
      glow.visible = false;
    }
  };
  mn.contacts = (playerPos) => {
    if (!mn.alive) return false;
    const dx = root.position.x - playerPos.x;
    const dz = root.position.z - playerPos.z;
    return dx * dx + dz * dz <= MONSTER.contactDist * MONSTER.contactDist;
  };
  mn.getState = () => ({
    x: root.position.x,
    y: root.position.y,
    z: root.position.z,
    frozen: mn.frozen,
    alive: mn.alive,
  });
  mn.setState = (s) => {
    // clients lerp toward host position
    root.position.x += (s.x - root.position.x) * 0.4;
    root.position.z += (s.z - root.position.z) * 0.4;
    mn.frozen = s.frozen;
    if (!s.alive && mn.alive) {
      mn.alive = false;
      root.visible = false;
      glow.visible = false;
    }
  };
  mn.position = () => root.position.clone();
  mn.dispose = () => {
    scene.remove(root);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    skin.dispose();
    eyeMat.dispose();
    eyeGeo.dispose();
    armGeo.dispose();
    glow.dispose();
  };

  void PLAYER; // (kept for tuning parity reference)
  return mn;
}
