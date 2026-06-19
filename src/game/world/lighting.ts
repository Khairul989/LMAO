import * as THREE from "three";
import { LIGHTNING, WORLD } from "@/game/config";
import type { AudioEngine } from "@/game/audio/audio";
import type { ModuleUpdate } from "@/game/types";

export interface LightingSystem extends ModuleUpdate {
  flashNow(): void; // trigger a lightning pulse (host broadcasts this)
  consumeFlashPulse(): boolean; // true once per fresh flash (for net sync)
  dispose(): void;
}

export function createLighting(
  scene: THREE.Scene,
  audio: AudioEngine,
): LightingSystem {
  const ambient = new THREE.AmbientLight(0x3a4660, WORLD.ambient);
  scene.add(ambient);

  // Hemisphere gives a faint cold sky / warm floor bounce so corners aren't pure black.
  const hemi = new THREE.HemisphereLight(0x223044, 0x0a0805, 0.12);
  scene.add(hemi);

  // The lightning light: a strong directional flash from "outside".
  const bolt = new THREE.DirectionalLight(0xbfd0ff, 0);
  bolt.position.set(6, 20, 30);
  scene.add(bolt);

  let nextFlash = LIGHTNING.minGap + Math.random() * (LIGHTNING.maxGap - LIGHTNING.minGap);
  let timer = 0;
  let flashEnergy = 0; // decays after a flash
  let flashPulse = false; // set true the frame a flash starts

  function triggerFlash() {
    flashEnergy = LIGHTNING.flashIntensity;
    flashPulse = true;
    // Double-flicker for realism
    setTimeout(() => {
      flashEnergy = LIGHTNING.flashIntensity * 0.7;
    }, 90);
    audio.thunder();
  }

  const update: LightingSystem = ((dt: number) => {
    timer += dt;
    if (timer >= nextFlash) {
      timer = 0;
      nextFlash =
        LIGHTNING.minGap + Math.random() * (LIGHTNING.maxGap - LIGHTNING.minGap);
      triggerFlash();
    }
    if (flashEnergy > 0) {
      flashEnergy = Math.max(0, flashEnergy - LIGHTNING.flashDecay * dt);
      bolt.intensity = flashEnergy;
      ambient.intensity = WORLD.ambient + flashEnergy * 0.25;
    } else {
      bolt.intensity = 0;
      ambient.intensity = WORLD.ambient;
    }
  }) as unknown as LightingSystem;

  update.flashNow = () => triggerFlash();
  update.consumeFlashPulse = () => {
    const p = flashPulse;
    flashPulse = false;
    return p;
  };
  update.dispose = () => {
    scene.remove(ambient);
    scene.remove(hemi);
    scene.remove(bolt);
    ambient.dispose();
    hemi.dispose();
    bolt.dispose();
  };

  return update;
}
