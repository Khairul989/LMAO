import * as THREE from "three";
import { AMMO } from "@/game/config";
import type { AudioEngine } from "@/game/audio/audio";
import type { ModuleUpdate } from "@/game/types";

export interface ShotResult {
  hit: THREE.Object3D | null;
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  point: THREE.Vector3 | null;
}

export interface Weapon extends ModuleUpdate {
  group: THREE.Group;
  ammo: number;
  reserve: number;
  tryShoot(targets: THREE.Object3D[]): ShotResult | null;
  reload(): void;
  addAmmo(n: number): void;
  dispose(): void;
}

export function createWeapon(
  camera: THREE.PerspectiveCamera,
  audio: AudioEngine,
): Weapon {
  const group = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({
    color: 0x20242b,
    roughness: 0.4,
    metalness: 0.85,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x14110d,
    roughness: 0.8,
    metalness: 0.1,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.5), metal);
  body.position.set(0, 0, -0.1);
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.5, 12),
    metal,
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, -0.42);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.12), gripMat);
  grip.position.set(0, -0.16, 0.05);
  grip.rotation.x = 0.3;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.04), metal);
  sight.position.set(0, 0.11, -0.2);
  group.add(body, barrel, grip, sight);

  // muzzle flash light at the barrel tip
  const muzzle = new THREE.PointLight(0xffd07a, 0, 6, 2);
  muzzle.position.set(0, 0.03, -0.7);
  group.add(muzzle);
  const flashMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0 }),
  );
  flashMesh.position.copy(muzzle.position);
  group.add(flashMesh);

  const basePos = new THREE.Vector3(0.34, -0.32, -0.7);
  group.position.copy(basePos);
  group.rotation.set(0, 0.04, 0);
  camera.add(group);

  const raycaster = new THREE.Raycaster();
  raycaster.far = 80;
  const center = new THREE.Vector2(0, 0);

  let cooldown = 0;
  let recoil = 0;
  let flash = 0;

  const wp: Weapon = ((dt: number) => {
    cooldown = Math.max(0, cooldown - dt);
    // recoil recovery
    recoil = Math.max(0, recoil - dt * 6);
    group.position.z = basePos.z + recoil * 0.12;
    group.rotation.x = -recoil * 0.25;
    // muzzle flash decay
    flash = Math.max(0, flash - dt * 30);
    muzzle.intensity = flash * 5;
    (flashMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, flash);
    flashMesh.scale.setScalar(0.6 + flash * 0.8);
  }) as unknown as Weapon;

  wp.group = group;
  wp.ammo = AMMO.start;
  wp.reserve = AMMO.reserve;

  wp.tryShoot = (targets) => {
    if (cooldown > 0) return null;
    if (wp.ammo <= 0) {
      audio.dryFire();
      cooldown = 0.2;
      return null;
    }
    wp.ammo -= 1;
    cooldown = AMMO.fireCooldown;
    recoil = 1;
    flash = 1;
    audio.gunshot();

    raycaster.setFromCamera(center, camera);
    const origin = raycaster.ray.origin.clone();
    const dir = raycaster.ray.direction.clone();

    let hit: THREE.Object3D | null = null;
    let point: THREE.Vector3 | null = null;
    if (targets.length) {
      const hits = raycaster.intersectObjects(targets, true);
      if (hits.length) {
        point = hits[0].point.clone();
        // walk up to the registered target root
        let o: THREE.Object3D | null = hits[0].object;
        while (o) {
          if (targets.includes(o)) {
            hit = o;
            break;
          }
          o = o.parent;
        }
      }
    }
    return { hit, origin, dir, point };
  };

  wp.reload = () => {
    if (wp.reserve <= 0 || wp.ammo >= AMMO.max) return;
    const need = AMMO.max - wp.ammo;
    const take = Math.min(need, wp.reserve);
    wp.ammo += take;
    wp.reserve -= take;
    audio.ammoPickup();
  };

  wp.addAmmo = (n) => {
    wp.reserve += n;
  };

  wp.dispose = () => {
    camera.remove(group);
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    muzzle.dispose();
  };

  return wp;
}
