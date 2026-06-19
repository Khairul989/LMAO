import * as THREE from "three";
import { AMMO, BATTERY, KEYS, NET } from "@/game/config";
import { AudioEngine } from "@/game/audio/audio";
import { createRenderer } from "@/game/engine/renderer";
import { buildWorld } from "@/game/world/floorplan";
import { createLighting } from "@/game/world/lighting";
import { createController } from "@/game/player/controls";
import { createFlashlight } from "@/game/player/flashlight";
import { createWeapon } from "@/game/combat/weapon";
import { createPickups } from "@/game/items/pickups";
import { createMonster } from "@/game/monster/monster";
import type { NetManager } from "@/game/net/net";
import { gameStore } from "@/game/state/store";
import { mulberry32 } from "@/game/rng";
import type { Mode, NetSnapshot, RemoteState } from "@/game/types";

export interface GameOptions {
  mode: Mode;
  net: NetManager;
  seed: number;
}

export interface GameHandle {
  start(): void;
  resume(): void; // call from a user gesture: unlock audio + acquire pointer lock
  dispose(): void;
}

interface RemotePlayer {
  state: RemoteState;
  lastSeen: number;
  root: THREE.Group;
  cone: THREE.Mesh;
}

const HUD_INTERVAL = 0.08; // ~12Hz store writes

export function createGame(
  canvas: HTMLCanvasElement,
  opts: GameOptions,
): GameHandle {
  const { mode, net, seed } = opts;
  const isHost = mode === "host";
  const isClient = mode === "join";

  const rng = mulberry32(seed);
  const audio = new AudioEngine();
  const { scene, camera, renderer, dispose: disposeRenderer } =
    createRenderer(canvas);

  const world = buildWorld(scene, rng);
  const controller = createController(camera, canvas);
  controller.setColliders(world.colliders);
  controller.teleport(world.spawn);
  scene.add(controller.object);

  const flashlight = createFlashlight(camera);
  const weapon = createWeapon(camera, audio);
  const pickups = createPickups(scene, world, rng, audio);
  const monster = createMonster(scene, world, audio);
  monster.aiEnabled = !isClient; // clients follow host snapshots
  const lighting = createLighting(scene, audio);

  const store = gameStore.getState();
  gameStore.setState({
    battery: flashlight.battery,
    ammo: weapon.ammo,
    reserveAmmo: weapon.reserve,
    maxAmmo: AMMO.max,
    keysFound: 0,
    health: 100,
    flashlightOn: flashlight.on,
  });
  void store;

  // --- remote players ---
  const remotePlayers = new Map<string, RemotePlayer>();
  let clientKeyState: boolean[] = new Array(KEYS.count).fill(false);

  function avatarColor(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return new THREE.Color().setHSL((h % 360) / 360, 0.7, 0.55).getHex();
  }

  function makeAvatar(id: string): RemotePlayer {
    const root = new THREE.Group();
    const color = avatarColor(id);
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 1.0, 6, 12),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        roughness: 0.6,
      }),
    );
    body.position.y = 1.0;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 }),
    );
    head.position.y = 1.7;
    // flashlight indicator cone
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1.4, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff1d0,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(0, 1.5, -0.9);
    root.add(body, head, cone);
    scene.add(root);
    const rp: RemotePlayer = {
      state: { id, x: 0, y: 0, z: 0, ry: 0, flashlightOn: true, lit: false },
      lastSeen: performance.now(),
      root,
      cone,
    };
    remotePlayers.set(id, rp);
    return rp;
  }

  function removeAvatar(id: string) {
    const rp = remotePlayers.get(id);
    if (!rp) return;
    scene.remove(rp.root);
    rp.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | undefined;
      if (mat) mat.dispose();
    });
    remotePlayers.delete(id);
  }

  // --- net callbacks ---
  net.setCallbacks({
    onPlayerJoin: (id) => {
      if (!remotePlayers.has(id)) makeAvatar(id);
    },
    onPlayerLeave: (id) => removeAvatar(id),
    onRemoteState: (s) => {
      let rp = remotePlayers.get(s.id);
      if (!rp) rp = makeAvatar(s.id);
      rp.state = s;
      rp.lastSeen = performance.now();
    },
    onSnapshot: (s: NetSnapshot) => {
      if (!isClient) return;
      monster.setState(s.monster);
      pickups.setKeyState(s.keys);
      clientKeyState = s.keys;
      if (s.lightning) lighting.flashNow();
    },
    onShoot: (ox, oy, oz, dx, dy, dz) => {
      if (!isHost) return;
      // host adjudicates a client's shot against the monster
      const ray = new THREE.Raycaster(
        new THREE.Vector3(ox, oy, oz),
        new THREE.Vector3(dx, dy, dz).normalize(),
      );
      ray.far = 80;
      const hits = ray.intersectObject(monster.hitGroup, true);
      if (hits.length) monster.damage(AMMO.damagePerShot);
    },
    onPickup: (kind, index) => {
      if (!isHost) return;
      // only keys are shared/authoritative; battery+ammo are local economy
      if (kind === "key") {
        const s = pickups.keyState();
        s[index] = true;
        pickups.setKeyState(s);
      }
    },
    onStart: () => {},
    onHit: () => {},
  });

  // --- input ---
  let dead = false;
  let won = false;

  function onCanvasMouseDown(e: MouseEvent) {
    if (dead || won) return;
    if (controller.isLocked() && e.button === 0) shoot();
  }

  function shoot() {
    if (isClient) {
      const r = weapon.tryShoot([]); // local fx + ammo only; host adjudicates
      if (r) net.sendShoot(r.origin.x, r.origin.y, r.origin.z, r.dir.x, r.dir.y, r.dir.z);
    } else {
      const r = weapon.tryShoot([monster.hitGroup]);
      if (r?.hit) monster.damage(AMMO.damagePerShot);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (dead || won) return;
    if (e.code === "KeyF") {
      flashlight.toggle();
    } else if (e.code === "KeyR") {
      weapon.reload();
    } else if (e.code === "KeyE") {
      tryEscape();
    }
  }

  function keysFoundCount(): number {
    if (isClient) return clientKeyState.filter(Boolean).length;
    return pickups.keyState().filter(Boolean).length;
  }

  function tryEscape() {
    const playerPos = controller.object.position;
    if (!world.doorBox.containsPoint(playerPos)) return;
    if (keysFoundCount() >= KEYS.count) triggerVictory();
  }

  function triggerVictory() {
    if (won || dead) return;
    won = true;
    controller.unlock();
    audio.keyPickup();
    audio.stopAmbience();
    gameStore.getState().setPhase("victory");
  }

  function triggerDeath() {
    if (dead || won) return;
    dead = true;
    controller.unlock();
    audio.jumpscare();
    audio.stopAmbience();
    gameStore.setState({ health: 0 });
    gameStore.getState().setPhase("dead");
  }

  canvas.addEventListener("mousedown", onCanvasMouseDown);
  document.addEventListener("keydown", onKeyDown);

  // --- loop ---
  let raf = 0;
  let last = performance.now();
  let hudTimer = 0;
  let netTimer = 0;
  let toast = "";
  let toastTimer = 0;
  let frames = 0;
  let fpsTimer = 0;
  let fps = 0;
  let stepTimer = 0;
  const tickInterval = 1 / NET.tickHz;
  const _mpos = new THREE.Vector3();
  const _camPos = new THREE.Vector3();
  const _ray = new THREE.Ray();
  const _hit = new THREE.Vector3();

  // Is the straight line camera->point blocked by a wall? (freeze needs line of sight)
  function occluded(point: THREE.Vector3): boolean {
    camera.getWorldPosition(_camPos);
    const dir = point.clone().sub(_camPos);
    const dist = dir.length();
    if (dist < 0.001) return false;
    dir.multiplyScalar(1 / dist);
    _ray.set(_camPos, dir);
    for (const b of world.colliders) {
      const r = _ray.intersectBox(b, _hit);
      if (r && _hit.distanceTo(_camPos) < dist - 0.7) return true;
    }
    return false;
  }

  function setToast(msg: string, secs = 2.5) {
    toast = msg;
    toastTimer = secs;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05); // clamp for stability

    // fps
    frames++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      fps = Math.round(frames / fpsTimer);
      frames = 0;
      fpsTimer = 0;
    }

    if (!dead && !won) {
      controller(dt, now);
      flashlight(dt, now);
      weapon(dt, now);
      pickups(dt, now);
      lighting(dt, now);

      const playerPos = controller.object.position;
      _mpos.copy(monster.mesh.position);

      // monster targeting (host picks nearest player)
      if (isHost) {
        let nearest = playerPos;
        let bestD = playerPos.distanceToSquared(_mpos);
        remotePlayers.forEach((rp) => {
          const d =
            (rp.state.x - _mpos.x) ** 2 + (rp.state.z - _mpos.z) ** 2;
          if (d < bestD) {
            bestD = d;
            nearest = new THREE.Vector3(rp.state.x, 0, rp.state.z);
          }
        });
        monster.setTarget(nearest);
      } else if (!isClient) {
        monster.setTarget(playerPos);
      }

      // FREEZE RULE
      const selfLit =
        monster.alive &&
        flashlight.illuminates(camera, _mpos) &&
        !occluded(_mpos);
      if (!isClient) {
        let anyLit = selfLit;
        remotePlayers.forEach((rp) => {
          if (rp.state.lit) anyLit = true;
        });
        monster.setFreeze(monster.alive && anyLit);
      }
      monster(dt, now);

      // pickups collection (local)
      const events = pickups.collect(playerPos);
      for (const ev of events) {
        if (ev.kind === "battery") {
          flashlight.addBattery(BATTERY.refillPct);
          setToast("+40% BATTERY");
        } else if (ev.kind === "ammo") {
          weapon.addAmmo(ev.n);
          setToast(`+${ev.n} AMMO`);
        } else if (ev.kind === "key") {
          if (isClient) net.sendPickup("key", ev.index);
          else {
            const s = pickups.keyState();
            s[ev.index] = true;
            pickups.setKeyState(s);
          }
          setToast("BRASS KEY ACQUIRED");
        }
      }

      // monster contact -> death (local adjudication using rendered position)
      const contactDx = _mpos.x - playerPos.x;
      const contactDz = _mpos.z - playerPos.z;
      if (
        monster.alive &&
        contactDx * contactDx + contactDz * contactDz < 1.15 * 1.15
      ) {
        triggerDeath();
      }

      // door / victory prompt
      const keys = keysFoundCount();
      const nearDoor = world.doorBox.containsPoint(playerPos);
      let prompt = "";
      if (nearDoor) {
        prompt =
          keys >= KEYS.count
            ? "Press E to ESCAPE"
            : `The door is locked — ${KEYS.count - keys} key(s) left`;
      }

      // footstep audio
      if (controller.moving) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          stepTimer = 0.42;
          audio.footstep();
        }
      }

      // --- net sync ---
      netTimer += dt;
      if ((isHost || isClient) && netTimer >= tickInterval) {
        netTimer = 0;
        const yaw = controller.getYaw();
        const st: RemoteState = {
          id: net.selfId,
          x: playerPos.x,
          y: playerPos.y,
          z: playerPos.z,
          ry: yaw,
          flashlightOn: flashlight.on,
          lit: selfLit,
        };
        net.sendState(st);
        if (isHost) {
          const snap: NetSnapshot = {
            seed,
            monster: monster.getState(),
            keys: pickups.keyState(),
            doorOpen: keys >= KEYS.count,
            lightning: lighting.consumeFlashPulse(),
          };
          net.broadcastSnapshot(snap);
        }
      }

      // update remote avatars + cull stale
      remotePlayers.forEach((rp, id) => {
        if (now - rp.lastSeen > 6000) {
          removeAvatar(id);
          return;
        }
        rp.root.position.x += (rp.state.x - rp.root.position.x) * 0.3;
        rp.root.position.z += (rp.state.z - rp.root.position.z) * 0.3;
        rp.root.rotation.y = rp.state.ry;
        rp.cone.visible = rp.state.flashlightOn;
      });

      // --- HUD throttle ---
      toastTimer = Math.max(0, toastTimer - dt);
      hudTimer += dt;
      if (hudTimer >= HUD_INTERVAL) {
        hudTimer = 0;
        gameStore.setState({
          battery: flashlight.battery,
          flashlightOn: flashlight.on,
          ammo: weapon.ammo,
          reserveAmmo: weapon.reserve,
          maxAmmo: AMMO.max,
          keysFound: keys,
          monsterFrozen: monster.frozen && monster.alive,
          toast: toastTimer > 0 ? toast : "",
          prompt,
          nearDoor,
          remotePlayers: remotePlayers.size,
          fps,
        });
      }
    }

    renderer.render(scene, camera);
  }

  return {
    start() {
      last = performance.now();
      // auto-acquire pointer lock attempt (browser may require a click first)
      raf = requestAnimationFrame(frame);
    },
    resume() {
      audio.resume();
      audio.startAmbience();
      if (!dead && !won) controller.lock();
    },
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousedown", onCanvasMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      controller.unlock();
      remotePlayers.forEach((_, id) => removeAvatar(id));
      flashlight.dispose();
      weapon.dispose();
      pickups.dispose();
      monster.dispose();
      lighting.dispose();
      controller.dispose();
      world.dispose();
      audio.dispose();
      disposeRenderer();
    },
  };
}
