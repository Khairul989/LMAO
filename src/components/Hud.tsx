"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/game/state/store";

export default function Hud() {
  const battery = useGameStore((s) => s.battery);
  const flashlightOn = useGameStore((s) => s.flashlightOn);
  const ammo = useGameStore((s) => s.ammo);
  const reserve = useGameStore((s) => s.reserveAmmo);
  const keysFound = useGameStore((s) => s.keysFound);
  const keysTotal = useGameStore((s) => s.keysTotal);
  const level = useGameStore((s) => s.level);
  const monsterFrozen = useGameStore((s) => s.monsterFrozen);
  const toast = useGameStore((s) => s.toast);
  const prompt = useGameStore((s) => s.prompt);
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const fps = useGameStore((s) => s.fps);
  const spectating = useGameStore((s) => s.spectating);
  const spectateName = useGameStore((s) => s.spectateName);

  // touch devices: lift battery/ammo off the bottom so they don't sit under the buttons
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(
      (typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches) ||
        "ontouchstart" in window ||
        (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0),
    );
  }, []);

  const batteryColor =
    battery > 50 ? "bg-toxic" : battery > 20 ? "bg-yellow-400" : "bg-blood";
  const low = battery <= 20 && battery > 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-mono text-white">
      {/* SPECTATOR MODE — dead, watching a teammate */}
      {spectating && (
        <>
          <div className="absolute inset-0 vignette bg-blood/10" />
          <div className="absolute left-1/2 top-8 -translate-x-1/2 text-center">
            <div className="text-3xl font-black tracking-widest text-blood drop-shadow-[0_0_14px_rgba(200,30,30,0.8)]">
              ☠ YOU DIED
            </div>
            <div className="mt-1 text-sm uppercase tracking-[0.3em] text-white/70">
              Spectating <span className="text-cyber">{spectateName || "…"}</span>
            </div>
            <div className="mt-1 text-xs text-white/40">
              Press Q to switch survivor · your team can still escape
            </div>
          </div>
        </>
      )}

      {/* crosshair (living only) */}
      {!spectating && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-5 w-5">
            <span className="absolute left-1/2 top-0 h-1.5 w-0.5 -translate-x-1/2 bg-white/80" />
            <span className="absolute bottom-0 left-1/2 h-1.5 w-0.5 -translate-x-1/2 bg-white/80" />
            <span className="absolute left-0 top-1/2 h-0.5 w-1.5 -translate-y-1/2 bg-white/80" />
            <span className="absolute right-0 top-1/2 h-0.5 w-1.5 -translate-y-1/2 bg-white/80" />
            <span className="absolute left-1/2 top-1/2 h-0.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blood" />
          </div>
        </div>
      )}

      {/* FROZEN indicator */}
      {monsterFrozen && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 text-center">
          <span className="rounded bg-cyber/20 px-3 py-1 text-sm font-bold tracking-[0.3em] text-cyber drop-shadow-[0_0_10px_rgba(25,227,255,0.7)]">
            ❄ FROZEN ❄
          </span>
        </div>
      )}

      {/* contextual prompt */}
      {prompt && (
        <div className="absolute left-1/2 top-[64%] -translate-x-1/2 whitespace-nowrap rounded bg-black/60 px-4 py-2 text-center text-base font-semibold text-brass">
          {prompt}
        </div>
      )}

      {/* toast */}
      {toast && (
        <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-lg border border-white/20 bg-black/70 px-5 py-2 text-sm font-bold uppercase tracking-widest text-toxic">
          {toast}
        </div>
      )}

      {/* top bar: keys + players + fps */}
      <div className="absolute left-0 right-0 top-0 flex items-start justify-between p-5">
        <div className="rounded-lg border border-white/10 bg-black/50 px-4 py-2 backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between gap-3 text-[10px] uppercase tracking-widest text-white/40">
            <span>Brass Keys</span>
            <span className="rounded bg-blood/25 px-1.5 py-0.5 font-bold text-blood">
              ⛓ Level {level}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: keysTotal }).map((_, i) => (
              <span
                key={i}
                className={`text-2xl transition ${
                  i < keysFound
                    ? "text-brass drop-shadow-[0_0_8px_rgba(216,169,58,0.8)]"
                    : "text-white/15"
                }`}
              >
                🔑
              </span>
            ))}
            <span className="ml-1 text-sm text-white/60">
              {keysFound}/{keysTotal}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 text-right">
          {remotePlayers > 0 && (
            <div className="rounded bg-black/50 px-3 py-1 text-xs text-cyber">
              👥 {remotePlayers} survivor{remotePlayers > 1 ? "s" : ""} nearby
            </div>
          )}
          <div className="rounded bg-black/40 px-2 py-0.5 text-[10px] text-white/30">
            {fps} FPS
          </div>
        </div>
      </div>

      {/* battery + flashlight (living only) — top-left on touch, bottom-left on desktop */}
      {!spectating && (
        <div
          className={`absolute w-52 sm:w-64 ${
            isTouch ? "left-4 top-28" : "bottom-6 left-6"
          }`}
        >
          <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-widest text-white/50">
            <span>🔦 Flashlight {flashlightOn ? "" : "(OFF)"}</span>
            <span className={low ? "text-blood" : ""}>{Math.ceil(battery)}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full border border-white/20 bg-black/60">
            <div
              className={`h-full ${batteryColor} ${low ? "animate-pulseBar" : ""} transition-[width] duration-200`}
              style={{ width: `${Math.max(0, Math.min(100, battery))}%` }}
            />
          </div>
          {battery <= 0 && (
            <div className="mt-1 text-xs font-bold text-blood">
              BATTERY DEAD — IT CAN MOVE
            </div>
          )}
        </div>
      )}

      {/* ammo (living only) — top-right on touch, bottom-right on desktop */}
      {!spectating && (
        <div
          className={`absolute text-right ${
            isTouch ? "right-4 top-28" : "bottom-6 right-6"
          }`}
        >
          <div className="text-[11px] uppercase tracking-widest text-white/50">
            Ammo
          </div>
          <div className="font-mono text-4xl font-black leading-none">
            <span className={ammo === 0 ? "text-blood" : "text-white"}>{ammo}</span>
            <span className="text-xl text-white/40"> / {reserve}</span>
          </div>
          {ammo === 0 && reserve > 0 && (
            <div className="text-xs text-yellow-400">Press R to reload</div>
          )}
        </div>
      )}
    </div>
  );
}
