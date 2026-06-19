import * as THREE from "three";
import { FLASHLIGHT, FREEZE } from "@/game/config";
import type { ModuleUpdate } from "@/game/types";

export interface Flashlight extends ModuleUpdate {
  spot: THREE.SpotLight;
  on: boolean;
  battery: number; // 0..100
  toggle(): void;
  setOn(on: boolean): void;
  addBattery(pct: number): void;
  illuminates(camera: THREE.Camera, worldPoint: THREE.Vector3): boolean;
  dispose(): void;
}

export function createFlashlight(camera: THREE.PerspectiveCamera): Flashlight {
  const spot = new THREE.SpotLight(
    0xfff1d0,
    FLASHLIGHT.intensity,
    FLASHLIGHT.distance,
    FLASHLIGHT.coneAngleRad,
    FLASHLIGHT.penumbra,
    FLASHLIGHT.decay,
  );
  spot.position.set(0.12, -0.1, 0.1);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 0.2;
  spot.shadow.camera.far = FLASHLIGHT.distance;
  spot.shadow.bias = -0.0006;

  const target = new THREE.Object3D();
  target.position.set(0, 0, -1);
  camera.add(target);
  spot.target = target;
  camera.add(spot);

  // a faint warm fill so the immediate foreground isn't pitch black
  const fill = new THREE.PointLight(0xffe9c0, 0.25, 4, 2);
  fill.position.set(0, -0.2, 0.2);
  camera.add(fill);

  const _camPos = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _to = new THREE.Vector3();

  const fl: Flashlight = ((dt: number) => {
    if (fl.on && fl.battery > 0) {
      fl.battery = Math.max(0, fl.battery - FLASHLIGHT.drainPerSec * dt);
      if (fl.battery <= 0) {
        fl.on = false;
      }
    }
    const want = fl.on && fl.battery > 0;
    // smooth intensity so toggling isn't a hard pop; flicker when low
    let targetI = want ? FLASHLIGHT.intensity : 0;
    if (want && fl.battery < 20) {
      targetI *= 0.55 + 0.45 * Math.abs(Math.sin(performance.now() * 0.02));
    }
    spot.intensity += (targetI - spot.intensity) * Math.min(1, 12 * dt);
    fill.intensity = want ? 0.25 : 0.04;
  }) as unknown as Flashlight;

  fl.spot = spot;
  fl.on = true;
  fl.battery = FLASHLIGHT.maxBattery;
  fl.toggle = () => {
    if (fl.battery > 0) fl.on = !fl.on;
  };
  fl.setOn = (on) => {
    if (on && fl.battery > 0) fl.on = true;
    else if (!on) fl.on = false;
  };
  fl.addBattery = (pct) => {
    fl.battery = Math.min(FLASHLIGHT.maxBattery, fl.battery + pct);
  };

  // Freeze rule test: is worldPoint within the lit cone (and is the light on)?
  fl.illuminates = (cam, worldPoint) => {
    if (!fl.on || fl.battery <= 0) return false;
    cam.getWorldPosition(_camPos);
    cam.getWorldDirection(_fwd);
    _to.copy(worldPoint).sub(_camPos);
    const dist = _to.length();
    if (dist > FREEZE.maxRange || dist < 0.0001) return false;
    _to.multiplyScalar(1 / dist);
    return _fwd.dot(_to) >= FREEZE.dotThreshold;
  };

  fl.dispose = () => {
    camera.remove(spot);
    camera.remove(target);
    camera.remove(fill);
    spot.dispose();
    fill.dispose();
  };

  return fl;
}
