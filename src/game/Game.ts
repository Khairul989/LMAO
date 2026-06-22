import * as THREE from "three";
import { AMMO, BATTERY, DESCEND, FLASHLIGHT, NET, levelSpec } from "@/game/config";
import { AudioEngine } from "@/game/audio/audio";
import { createRenderer } from "@/game/engine/renderer";
import { buildWorld } from "@/game/world/floorplan";
import { createLighting } from "@/game/world/lighting";
import { createController } from "@/game/player/controls";
import { createFlashlight } from "@/game/player/flashlight";
import { createWeapon } from "@/game/combat/weapon";
import { createPickups, type Pickups } from "@/game/items/pickups";
import { createMonster, type Monster } from "@/game/monster/monster";
import type { NetManager } from "@/game/net/net";
import { gameStore } from "@/game/state/store";
import { mulberry32 } from "@/game/rng";
import type { Mode, NetSnapshot, RemoteState, WorldData } from "@/game/types";

export interface GameOptions {
  mode: Mode;
  net: NetManager;
  seed: number;
}

export interface GameInput {
  move(x: number, y: number): void; // analog -1..1
  look(dx: number, dy: number): void; // pixel deltas
  shoot(): void;
  toggleFlashlight(): void;
  reload(): void;
  interact(): void;
  cycleSpectate(): void;
}

export interface GameHandle {
  start(): void;
  resume(): void; // call from a user gesture: unlock audio + acquire pointer lock
  input: GameInput; // touch / mobile control surface
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

  const audio = new AudioEngine();
  const { scene, camera, renderer, dispose: disposeRenderer } =
    createRenderer(canvas);

  const controller = createController(camera, canvas);
  scene.add(controller.object);
  const flashlight = createFlashlight(camera);
  const weapon = createWeapon(camera, audio);
  const lighting = createLighting(scene, audio);

  // --- per-floor content (rebuilt on every descent) ---
  let level = 1;
  let world!: WorldData;
  let pickups!: Pickups;
  let monsters: Monster[] = [];
  let clientKeyState: boolean[] = [];

  // Each floor gets its own deterministic seed derived from the room seed, so
  // every peer builds the identical floor for a given level.
  function levelSeed(l: number): number {
    return (seed + l * 0x9e3779b1) >>> 0;
  }

  function spawnFor(w: WorldData): THREE.Vector3 {
    const sp = w.spawn.clone();
    if (mode !== "solo") {
      // offset each player's spawn a little so co-op survivors don't stack
      let h = 0;
      for (let i = 0; i < net.selfId.length; i++)
        h = (h * 31 + net.selfId.charCodeAt(i)) >>> 0;
      const ang = ((h % 360) * Math.PI) / 180;
      sp.x += Math.cos(ang) * 1.8;
      sp.z += Math.sin(ang) * 1.2;
    }
    return sp;
  }

  function buildLevelContent(l: number) {
    const spec = levelSpec(l);
    const rng = mulberry32(levelSeed(l));
    world = buildWorld(scene, rng);
    controller.setColliders(world.colliders);
    pickups = createPickups(scene, world, rng, audio, spec.keys);
    monsters = [];
    for (let i = 0; i < spec.monsters; i++) {
      const m = createMonster(scene, world, rng, audio, {
        speedMul: spec.monsterSpeedMul,
      });
      m.aiEnabled = !isClient; // clients follow host snapshots
      monsters.push(m);
    }
    flashlight.setDrainMul(spec.batteryDrainMul);
    scene.fog = new THREE.FogExp2(0x05060a, spec.fogDensity);
    clientKeyState = new Array(spec.keys).fill(false);
    controller.teleport(spawnFor(world));
    gameStore.setState({ level: l, keysTotal: spec.keys, keysFound: 0 });
  }

  function disposeLevelContent() {
    pickups?.dispose();
    monsters.forEach((m) => m.dispose());
    monsters = [];
    world?.dispose();
  }

  buildLevelContent(1);

  gameStore.setState({
    battery: flashlight.battery,
    ammo: weapon.ammo,
    reserveAmmo: weapon.reserve,
    maxAmmo: AMMO.max,
    keysFound: 0,
    health: 100,
    flashlightOn: flashlight.on,
  });

  // --- remote players ---
  const remotePlayers = new Map<string, RemotePlayer>();

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
      state: { id, x: 0, y: 0, z: 0, ry: 0, flashlightOn: true, lit: 0 },
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
      // host moved to a deeper floor before us -> resync
      if (s.level !== level) {
        doDescend(s.level);
        return;
      }
      for (let i = 0; i < monsters.length && i < s.monsters.length; i++)
        monsters[i].setState(s.monsters[i]);
      pickups.setKeyState(s.keys);
      clientKeyState = s.keys;
      if (s.lightning) lighting.flashNow();
    },
    onShoot: (ox, oy, oz, dx, dy, dz) => {
      if (!isHost) return;
      // host adjudicates a client's shot against the monsters
      const ray = new THREE.Raycaster(
        new THREE.Vector3(ox, oy, oz),
        new THREE.Vector3(dx, dy, dz).normalize(),
      );
      ray.far = 80;
      const groups = monsters.filter((m) => m.alive).map((m) => m.hitGroup);
      const hits = ray.intersectObjects(groups, true);
      if (hits.length) damageHitObject(hits[0].object);
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
    onDeath: (id) => onPeerDeath(id), // teammate died -> spectator model, room continues
    onWin: () => {}, // legacy team-extract; descent replaces it
    onEscape: () => hostDescend(), // a client reached the door -> host descends the room
    onDescend: (l) => doDescend(l), // host dropped us to the next floor
    onHit: () => {},
  });

  // walk a raycast hit up to its monster root and damage it
  function damageHitObject(obj: THREE.Object3D) {
    let o: THREE.Object3D | null = obj;
    while (o) {
      const m = monsters.find((mm) => mm.hitGroup === o);
      if (m) {
        m.damage(AMMO.damagePerShot);
        return;
      }
      o = o.parent;
    }
  }

  // --- player lifecycle state ---
  let localDead = false; // this player's avatar is dead
  let spectating = false; // dead but watching a living teammate
  let ended = false; // whole room dead -> game over
  let spectateIdx = 0;
  let specName = "";
  const deadPeers = new Set<string>();

  function aliveRemotes(): RemotePlayer[] {
    const out: RemotePlayer[] = [];
    remotePlayers.forEach((rp, id) => {
      if (!deadPeers.has(id)) out.push(rp);
    });
    return out;
  }

  function shortName(id: string): string {
    return id.replace(/^LMAO-/, "").slice(0, 6) || "survivor";
  }

  function onCanvasMouseDown(e: MouseEvent) {
    if (ended || localDead) return;
    if (controller.isLocked() && e.button === 0) shoot();
  }

  function shoot() {
    if (isClient) {
      const r = weapon.tryShoot([]); // local fx + ammo only; host adjudicates
      if (r) net.sendShoot(r.origin.x, r.origin.y, r.origin.z, r.dir.x, r.dir.y, r.dir.z);
    } else {
      const groups = monsters.filter((m) => m.alive).map((m) => m.hitGroup);
      const r = weapon.tryShoot(groups);
      if (r?.hit) damageHitObject(r.hit);
    }
  }

  function cycleSpectate() {
    const n = aliveRemotes().length;
    if (n > 0) spectateIdx = (spectateIdx + 1) % n;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (ended) return;
    if (localDead) {
      // spectator controls: cycle who we're watching
      if (e.code === "KeyQ" || e.code === "Space") cycleSpectate();
      return;
    }
    if (e.code === "KeyF") flashlight.toggle();
    else if (e.code === "KeyR") weapon.reload();
    else if (e.code === "KeyE") tryEscape();
  }

  function keysFoundCount(): number {
    if (isClient) return clientKeyState.filter(Boolean).length;
    return pickups.keyState().filter(Boolean).length;
  }

  function tryEscape() {
    if (localDead || ended) return;
    const playerPos = controller.object.position;
    if (!world.doorBox.containsPoint(playerPos)) return;
    if (keysFoundCount() < levelSpec(level).keys) return;
    if (isClient) net.sendEscape(); // ask the host to descend the whole room
    else hostDescend(); // solo + host descend immediately
  }

  // host (or solo) advances the floor and tells everyone to follow
  function hostDescend() {
    if (ended || isClient) return;
    const next = level + 1;
    net.sendDescend(next);
    doDescend(next);
  }

  // tear down the floor and rebuild the next one; revive everyone for a clean run
  function doDescend(l: number) {
    if (ended) return;
    level = l;
    localDead = false;
    spectating = false;
    deadPeers.clear();
    disposeLevelContent();
    buildLevelContent(l);
    // descent rewards: fresh battery + a little ammo
    flashlight.battery = FLASHLIGHT.maxBattery;
    flashlight.setOn(true);
    weapon.addAmmo(DESCEND.ammoReward);
    audio.keyPickup();
    setToast(`LEVEL ${l} — DESCEND DEEPER`, 3);
    gameStore.setState({ spectating: false, health: 100 });
  }

  // local player got caught
  function triggerDeath() {
    if (localDead || ended) return;
    localDead = true;
    flashlight.setOn(false);
    controller.unlock();
    audio.jumpscare();
    if (isHost || isClient) net.sendDeath(net.selfId);
    if (mode === "solo" || aliveRemotes().length === 0) {
      gameOver();
    } else {
      // become a spectator of a living teammate; the room (and host sim) continue
      spectating = true;
      spectateIdx = 0;
    }
  }

  // a remote teammate died
  function onPeerDeath(id: string) {
    deadPeers.add(id);
    if (localDead && spectating && aliveRemotes().length === 0) gameOver();
  }

  // everyone is dead -> game over (your score is the depth reached)
  function gameOver() {
    if (ended) return;
    ended = true;
    spectating = false;
    audio.stopAmbience();
    gameStore.setState({ health: 0, spectating: false });
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

  // alive player positions (self if alive + living remotes) for monster targeting
  function alivePlayerPoints(): THREE.Vector3[] {
    const pts: THREE.Vector3[] = [];
    if (!localDead) pts.push(controller.object.position);
    remotePlayers.forEach((rp, id) => {
      if (!deadPeers.has(id))
        pts.push(new THREE.Vector3(rp.state.x, 0, rp.state.z));
    });
    return pts;
  }

  // third-person follow-cam over a living teammate while dead
  function updateSpectator(dt: number) {
    const alive = aliveRemotes();
    if (alive.length === 0) {
      gameOver();
      return;
    }
    if (spectateIdx >= alive.length) spectateIdx = 0;
    const target = alive[spectateIdx];
    const tp = target.root.position;
    const ry = target.state.ry;
    // sit behind & above the teammate
    const camX = tp.x + Math.sin(ry) * 4.2;
    const camZ = tp.z + Math.cos(ry) * 4.2;
    const holder = controller.object;
    holder.position.lerp(new THREE.Vector3(camX, 3.0, camZ), Math.min(1, 4 * dt));
    camera.position.set(0, 0, 0);
    // aim at the teammate (yaw on holder, pitch on camera) — matches controls convention
    const fx = tp.x - holder.position.x;
    const fy = tp.y + 1.3 - holder.position.y;
    const fz = tp.z - holder.position.z;
    const len = Math.hypot(fx, fy, fz) || 1;
    holder.rotation.set(0, 0, 0);
    holder.rotation.y = Math.atan2(-fx / len, -fz / len);
    camera.rotation.x = Math.asin(Math.max(-1, Math.min(1, fy / len)));
    specName = shortName(target.state.id);
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

    // Sim runs until everyone is dead (ended). A dead-but-spectating player keeps
    // the loop alive — crucially a dead HOST keeps simulating + broadcasting so
    // survivors aren't stranded.
    if (!ended) {
      flashlight(dt, now); // off & non-draining once dead; fades the beam out
      lighting(dt, now);

      if (!localDead) {
        controller(dt, now);
        weapon(dt, now);
        pickups(dt, now);
      } else {
        updateSpectator(dt);
      }

      const playerPos = controller.object.position;

      // monster targeting (host) -> each monster chases its nearest LIVING player
      if (isHost) {
        const pts = alivePlayerPoints();
        if (pts.length) {
          for (const m of monsters) {
            if (!m.alive) continue;
            const mp = m.mesh.position;
            let best = Infinity;
            let nt = pts[0];
            for (const p of pts) {
              const d = (p.x - mp.x) ** 2 + (p.z - mp.z) ** 2;
              if (d < best) {
                best = d;
                nt = p;
              }
            }
            m.setTarget(nt);
          }
        }
      } else if (!isClient && !localDead) {
        for (const m of monsters) m.setTarget(playerPos); // solo
      }

      // FREEZE RULE — a monster freezes if any living player lights *it*.
      // selfMask bit i = this player is illuminating monster i.
      let selfMask = 0;
      if (!localDead) {
        for (let i = 0; i < monsters.length; i++) {
          const m = monsters[i];
          if (
            m.alive &&
            flashlight.illuminates(camera, m.mesh.position) &&
            !occluded(m.mesh.position)
          ) {
            selfMask |= 1 << i;
          }
        }
      }
      if (!isClient) {
        let anyMask = selfMask;
        remotePlayers.forEach((rp, id) => {
          if (!deadPeers.has(id)) anyMask |= rp.state.lit;
        });
        for (let i = 0; i < monsters.length; i++) {
          const m = monsters[i];
          m.setFreeze(m.alive && ((anyMask >> i) & 1) === 1);
        }
      }
      for (const m of monsters) m(dt, now);

      let keys = keysFoundCount();
      const totalKeys = levelSpec(level).keys;
      let prompt = "";
      let nearDoor = false;

      // living-player-only interactions
      if (!localDead) {
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

        // monster contact -> local death
        for (const m of monsters) {
          if (!m.alive) continue;
          const dx = m.mesh.position.x - playerPos.x;
          const dz = m.mesh.position.z - playerPos.z;
          if (dx * dx + dz * dz < 1.15 * 1.15) {
            triggerDeath();
            break;
          }
        }

        keys = keysFoundCount();
        nearDoor = world.doorBox.containsPoint(playerPos);
        if (nearDoor) {
          prompt =
            keys >= totalKeys
              ? "Press E to DESCEND"
              : `The door is locked — ${totalKeys - keys} key(s) left`;
        }

        if (controller.moving) {
          stepTimer -= dt;
          if (stepTimer <= 0) {
            stepTimer = 0.42;
            audio.footstep();
          }
        }
      }

      // --- net sync ---
      netTimer += dt;
      if ((isHost || isClient) && netTimer >= tickInterval) {
        netTimer = 0;
        if (!localDead) {
          const st: RemoteState = {
            id: net.selfId,
            x: playerPos.x,
            y: playerPos.y,
            z: playerPos.z,
            ry: controller.getYaw(),
            flashlightOn: flashlight.on,
            lit: selfMask,
          };
          net.sendState(st);
        }
        if (isHost) {
          const snap: NetSnapshot = {
            seed,
            level,
            monsters: monsters.map((m) => m.getState()),
            keys: pickups.keyState(),
            doorOpen: keys >= totalKeys,
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
        rp.cone.visible = rp.state.flashlightOn && !deadPeers.has(id);
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
          keysTotal: totalKeys,
          level,
          monsterFrozen: monsters.some((m) => m.frozen && m.alive),
          toast: toastTimer > 0 ? toast : "",
          prompt,
          nearDoor,
          remotePlayers: remotePlayers.size,
          fps,
          spectating,
          spectateName: specName,
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
      if (!localDead && !ended) controller.lock();
    },
    input: {
      move(x, y) {
        if (!localDead && !ended) controller.setMoveInput(x, y);
        else controller.setMoveInput(0, 0);
      },
      look(dx, dy) {
        if (!localDead && !ended) controller.look(dx, dy);
      },
      shoot() {
        if (!localDead && !ended) shoot();
      },
      toggleFlashlight() {
        if (!localDead && !ended) flashlight.toggle();
      },
      reload() {
        if (!localDead && !ended) weapon.reload();
      },
      interact() {
        if (!localDead && !ended) tryEscape();
      },
      cycleSpectate() {
        if (localDead && spectating) cycleSpectate();
      },
    },
    dispose() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousedown", onCanvasMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      controller.unlock();
      remotePlayers.forEach((_, id) => removeAvatar(id));
      flashlight.dispose();
      weapon.dispose();
      disposeLevelContent();
      lighting.dispose();
      controller.dispose();
      audio.dispose();
      disposeRenderer();
    },
  };
}
