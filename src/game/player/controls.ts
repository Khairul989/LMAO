import * as THREE from "three";
import { PLAYER } from "@/game/config";
import type { ModuleUpdate } from "@/game/types";

export interface PlayerController extends ModuleUpdate {
  object: THREE.Object3D; // yaw object holding the camera
  velocity: THREE.Vector3;
  moving: boolean;
  lock(): void;
  unlock(): void;
  isLocked(): boolean;
  setColliders(boxes: THREE.Box3[]): void;
  teleport(v: THREE.Vector3): void;
  getYaw(): number;
  setMoveInput(x: number, y: number): void; // analog move from touch (-1..1)
  look(dx: number, dy: number): void; // look delta from touch (pixels)
  dispose(): void;
}

export function createController(
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
): PlayerController {
  // yawObject holds the camera; yaw on the object, pitch on the camera.
  const yawObject = new THREE.Object3D();
  yawObject.position.set(0, PLAYER.eyeHeight, 0);
  yawObject.add(camera);
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);

  const velocity = new THREE.Vector3();
  const keys: Record<string, boolean> = {};
  const moveInput = { x: 0, y: 0 }; // analog touch joystick (-1..1), +y = forward
  let colliders: THREE.Box3[] = [];
  let pitch = 0;
  let bobPhase = 0;
  const sensitivity = 0.0022;
  const touchSensitivity = 0.005;
  const PITCH_LIMIT = Math.PI / 2 - 0.05;

  const ctrl: PlayerController = ((dt: number) => {
    // --- desired movement (keyboard + analog touch, combined & clamped) ---
    const kf = (keys["KeyW"] || keys["ArrowUp"] ? 1 : 0) - (keys["KeyS"] || keys["ArrowDown"] ? 1 : 0);
    const ks = (keys["KeyD"] || keys["ArrowRight"] ? 1 : 0) - (keys["KeyA"] || keys["ArrowLeft"] ? 1 : 0);
    const forward = Math.max(-1, Math.min(1, kf + moveInput.y));
    const strafe = Math.max(-1, Math.min(1, ks + moveInput.x));
    const sprint = keys["ShiftLeft"] || keys["ShiftRight"] ? PLAYER.sprintMul : 1;

    const dir = new THREE.Vector3(strafe, 0, -forward);
    if (dir.lengthSq() > 0) dir.normalize();
    // rotate desired dir by yaw
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawObject.rotation.y);

    const targetSpeed = PLAYER.speed * sprint;
    const target = dir.multiplyScalar(targetSpeed);

    // accelerate toward target, damp when idle
    const hasInput = Math.abs(forward) > 0.05 || Math.abs(strafe) > 0.05;
    const rate = hasInput ? PLAYER.accel : PLAYER.damping;
    velocity.x += (target.x - velocity.x) * Math.min(1, rate * dt);
    velocity.z += (target.z - velocity.z) * Math.min(1, rate * dt);

    ctrl.moving = hasInput && velocity.lengthSq() > 0.4;

    // --- integrate + per-axis collision ---
    const r = PLAYER.radius;
    const pos = yawObject.position;

    pos.x += velocity.x * dt;
    for (const b of colliders) {
      if (
        pos.x + r > b.min.x &&
        pos.x - r < b.max.x &&
        pos.z + r > b.min.z &&
        pos.z - r < b.max.z
      ) {
        // resolve along x
        if (velocity.x > 0) pos.x = b.min.x - r;
        else if (velocity.x < 0) pos.x = b.max.x + r;
        velocity.x = 0;
      }
    }

    pos.z += velocity.z * dt;
    for (const b of colliders) {
      if (
        pos.x + r > b.min.x &&
        pos.x - r < b.max.x &&
        pos.z + r > b.min.z &&
        pos.z - r < b.max.z
      ) {
        if (velocity.z > 0) pos.z = b.min.z - r;
        else if (velocity.z < 0) pos.z = b.max.z + r;
        velocity.z = 0;
      }
    }

    // --- head bob ---
    if (ctrl.moving) {
      bobPhase += dt * PLAYER.bobSpeed * sprint;
      camera.position.y = Math.sin(bobPhase) * PLAYER.bobAmount;
    } else {
      bobPhase = 0;
      camera.position.y *= 1 - Math.min(1, 10 * dt);
    }
    pos.y = PLAYER.eyeHeight;
  }) as unknown as PlayerController;

  ctrl.object = yawObject;
  ctrl.velocity = velocity;
  ctrl.moving = false;

  function onMouseMove(e: MouseEvent) {
    if (document.pointerLockElement !== dom) return;
    yawObject.rotation.y -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    camera.rotation.x = pitch;
  }
  function onKeyDown(e: KeyboardEvent) {
    keys[e.code] = true;
  }
  function onKeyUp(e: KeyboardEvent) {
    keys[e.code] = false;
  }
  function clearKeys() {
    for (const k in keys) keys[k] = false;
  }

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);
  // releasing pointer lock should stop runaway movement
  document.addEventListener("pointerlockchange", clearKeys);
  window.addEventListener("blur", clearKeys);

  ctrl.lock = () => {
    try {
      // requestPointerLock returns a Promise in modern Chrome; swallow rejection
      // (e.g. called without a fresh user gesture) so it never bubbles as uncaught.
      const p = dom.requestPointerLock() as unknown as Promise<void> | undefined;
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {
      /* pointer lock unavailable */
    }
  };
  ctrl.unlock = () => {
    if (document.pointerLockElement === dom) document.exitPointerLock();
  };
  ctrl.isLocked = () => document.pointerLockElement === dom;
  ctrl.setColliders = (boxes) => {
    colliders = boxes;
  };
  ctrl.teleport = (v) => {
    yawObject.position.set(v.x, PLAYER.eyeHeight, v.z);
    velocity.set(0, 0, 0);
  };
  ctrl.getYaw = () => yawObject.rotation.y;
  ctrl.setMoveInput = (x, y) => {
    moveInput.x = x;
    moveInput.y = y;
  };
  ctrl.look = (dx, dy) => {
    // touch look — applies regardless of pointer lock
    yawObject.rotation.y -= dx * touchSensitivity;
    pitch -= dy * touchSensitivity;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    camera.rotation.x = pitch;
  };
  ctrl.dispose = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("pointerlockchange", clearKeys);
    window.removeEventListener("blur", clearKeys);
  };

  return ctrl;
}
