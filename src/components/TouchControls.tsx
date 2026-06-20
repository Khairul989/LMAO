"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { GameHandle } from "@/game/Game";
import { useGameStore } from "@/game/state/store";
import { AMMO } from "@/game/config";

// On-screen controls for touch devices: left thumb = move joystick,
// right side = drag to look, buttons = shoot / flashlight / reload / interact.
export default function TouchControls({
  gameRef,
}: {
  gameRef: RefObject<GameHandle | null>;
}) {
  const spectating = useGameStore((s) => s.spectating);
  const nearDoor = useGameStore((s) => s.nearDoor);
  const flashlightOn = useGameStore((s) => s.flashlightOn);

  // joystick visual state
  const [joy, setJoy] = useState<{
    active: boolean;
    bx: number;
    by: number;
    tx: number;
    ty: number;
  }>({ active: false, bx: 0, by: 0, tx: 0, ty: 0 });

  const joyId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const fireTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const JOY_R = 56; // joystick radius in px

  const input = () => gameRef.current?.input;

  useEffect(() => {
    return () => {
      if (fireTimer.current) clearInterval(fireTimer.current);
    };
  }, []);

  // ---- movement joystick (left half) ----
  function onJoyDown(e: React.PointerEvent) {
    if (joyId.current !== null) return;
    joyId.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setJoy({ active: true, bx: e.clientX, by: e.clientY, tx: e.clientX, ty: e.clientY });
  }
  function onJoyMove(e: React.PointerEvent) {
    if (e.pointerId !== joyId.current) return;
    setJoy((j) => {
      let dx = e.clientX - j.bx;
      let dy = e.clientY - j.by;
      const len = Math.hypot(dx, dy);
      if (len > JOY_R) {
        dx = (dx / len) * JOY_R;
        dy = (dy / len) * JOY_R;
      }
      input()?.move(dx / JOY_R, -dy / JOY_R); // up = forward
      return { ...j, active: true, tx: j.bx + dx, ty: j.by + dy };
    });
  }
  function onJoyUp(e: React.PointerEvent) {
    if (e.pointerId !== joyId.current) return;
    joyId.current = null;
    input()?.move(0, 0);
    setJoy((j) => ({ ...j, active: false }));
  }

  // ---- look drag (right side, anywhere not on a control) ----
  function onLookDown(e: React.PointerEvent) {
    if (lookId.current !== null) return;
    lookId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    lookLast.current = { x: e.clientX, y: e.clientY };
  }
  function onLookMove(e: React.PointerEvent) {
    if (e.pointerId !== lookId.current) return;
    const dx = e.clientX - lookLast.current.x;
    const dy = e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
    input()?.look(dx, dy);
  }
  function onLookUp(e: React.PointerEvent) {
    if (e.pointerId !== lookId.current) return;
    lookId.current = null;
  }

  // ---- shoot (hold to auto-fire) ----
  function onShootDown(e: React.PointerEvent) {
    e.stopPropagation();
    input()?.shoot();
    if (fireTimer.current) clearInterval(fireTimer.current);
    fireTimer.current = setInterval(() => input()?.shoot(), AMMO.fireCooldown * 1000);
  }
  function stopShoot() {
    if (fireTimer.current) {
      clearInterval(fireTimer.current);
      fireTimer.current = null;
    }
  }

  const btn =
    "pointer-events-auto flex items-center justify-center rounded-full border backdrop-blur-sm active:scale-95 transition select-none";

  return (
    <div className="absolute inset-0 z-20 touch-none select-none">
      {/* LOOK layer — full screen, behind the joystick + buttons */}
      <div
        className="absolute inset-0"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookUp}
        onPointerCancel={onLookUp}
      />

      {/* MOVE joystick zone (left half) */}
      <div
        className="absolute bottom-0 left-0 top-0 w-1/2"
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
      >
        {joy.active && (
          <>
            <div
              className="pointer-events-none absolute rounded-full border-2 border-white/25 bg-white/5"
              style={{
                width: JOY_R * 2,
                height: JOY_R * 2,
                left: joy.bx - JOY_R,
                top: joy.by - JOY_R,
              }}
            />
            <div
              className="pointer-events-none absolute rounded-full border border-neon/60 bg-neon/30"
              style={{ width: 52, height: 52, left: joy.tx - 26, top: joy.ty - 26 }}
            />
          </>
        )}
        {!joy.active && (
          <div className="absolute bottom-10 left-10 text-[11px] uppercase tracking-widest text-white/30">
            ◐ drag to move
          </div>
        )}
      </div>

      {/* hint for look */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 text-right text-[11px] uppercase leading-relaxed tracking-widest text-white/25">
        drag here<br />to look
      </div>

      {spectating ? (
        // spectator: single switch-view button
        <button
          className={`${btn} absolute bottom-10 right-8 h-20 w-20 border-cyber/60 bg-cyber/15 text-3xl text-cyber`}
          onPointerDown={(e) => {
            e.stopPropagation();
            input()?.cycleSpectate();
          }}
        >
          👁
        </button>
      ) : (
        <>
          {/* SHOOT — big, bottom-right */}
          <button
            className={`${btn} absolute bottom-8 right-7 h-24 w-24 border-blood/70 bg-blood/25 text-4xl`}
            onPointerDown={onShootDown}
            onPointerUp={(e) => {
              e.stopPropagation();
              stopShoot();
            }}
            onPointerCancel={stopShoot}
            onPointerLeave={stopShoot}
          >
            🔫
          </button>

          {/* FLASHLIGHT */}
          <button
            className={`${btn} absolute bottom-36 right-10 h-16 w-16 text-2xl ${
              flashlightOn
                ? "border-yellow-300/70 bg-yellow-300/20"
                : "border-white/30 bg-white/5"
            }`}
            onPointerDown={(e) => {
              e.stopPropagation();
              input()?.toggleFlashlight();
            }}
          >
            🔦
          </button>

          {/* RELOAD */}
          <button
            className={`${btn} absolute bottom-12 right-36 h-16 w-16 border-white/30 bg-white/5 text-2xl`}
            onPointerDown={(e) => {
              e.stopPropagation();
              input()?.reload();
            }}
          >
            ⟳
          </button>

          {/* INTERACT — pulses when near the door */}
          <button
            className={`${btn} absolute bottom-40 right-32 h-16 w-16 text-xl font-black ${
              nearDoor
                ? "animate-pulseBar border-brass/80 bg-brass/30 text-brass"
                : "border-white/30 bg-white/5 text-white/80"
            }`}
            onPointerDown={(e) => {
              e.stopPropagation();
              input()?.interact();
            }}
          >
            E
          </button>
        </>
      )}
    </div>
  );
}
