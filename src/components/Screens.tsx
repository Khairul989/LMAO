"use client";

import { useGameStore } from "@/game/state/store";

export function LoadingScreen() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black text-white/60">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 spin rounded-full border-2 border-neon border-t-transparent" />
        Entering the dark…
      </div>
    </div>
  );
}

export function DeathScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden bg-blood/30">
      {/* full-screen red flash + glitch */}
      <div className="absolute inset-0 animate-flicker bg-gradient-to-br from-blood/60 via-black to-black" />
      <div
        className="pointer-events-none absolute inset-0 mix-blend-screen"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255,0,0,0.4), transparent 60%)",
        }}
      />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="mb-2 animate-glitch text-7xl sm:text-9xl">😱</div>
        <h1 className="animate-glitch text-6xl font-black tracking-tighter text-red-500 drop-shadow-[0_0_30px_rgba(255,0,0,0.8)] sm:text-8xl">
          YOU DIED
        </h1>
        <p className="mt-4 max-w-md text-sm text-red-200/80">
          It caught you in the dark. The flashlight was your only friend, and you
          let it down.
        </p>
        <button
          onClick={onRestart}
          className="pointer-events-auto mt-10 rounded-xl border border-red-400/60 bg-red-500/10 px-10 py-4 text-lg font-bold uppercase tracking-widest text-white transition hover:bg-red-500/25 hover:shadow-[0_0_40px_rgba(255,0,0,0.5)]"
        >
          ↻ Restart Game
        </button>
      </div>
    </div>
  );
}

export function VictoryScreen({ onRestart }: { onRestart: () => void }) {
  const keys = useGameStore((s) => s.keysFound);
  return (
    <div className="crt vignette absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/95 px-6 text-center">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-toxic/15 blur-[130px]" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 text-7xl sm:text-8xl">🏃💨🚪</div>
        <h1 className="text-6xl font-black tracking-tighter text-toxic drop-shadow-[0_0_30px_rgba(124,255,91,0.6)] sm:text-8xl">
          YOU ESCAPED
        </h1>
        <p className="mt-4 max-w-md text-sm text-white/60">
          {keys}/3 keys, one front door, and a whole lot of nerve. You made it out
          alive. The thing is still in there. Waiting.
        </p>
        <button
          onClick={onRestart}
          className="pointer-events-auto mt-10 rounded-xl border border-toxic/50 bg-toxic/10 px-10 py-4 text-lg font-bold uppercase tracking-widest text-white transition hover:bg-toxic/20 hover:shadow-[0_0_40px_rgba(124,255,91,0.4)]"
        >
          ↻ Play Again
        </button>
      </div>
    </div>
  );
}
