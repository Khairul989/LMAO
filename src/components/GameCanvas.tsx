"use client";

import { useEffect, useRef, useState } from "react";
import { createGame, type GameHandle } from "@/game/Game";
import type { NetManager } from "@/game/net/net";
import type { Mode } from "@/game/types";
import { useGameStore } from "@/game/state/store";

export default function GameCanvas({
  mode,
  net,
  seed,
}: {
  mode: Mode;
  net: NetManager;
  seed: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameHandle | null>(null);
  const [locked, setLocked] = useState(false);
  const spectating = useGameStore((s) => s.spectating);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const game = createGame(canvas, { mode, net, seed });
    gameRef.current = game;
    game.start();

    const onLockChange = () => setLocked(document.pointerLockElement === canvas);
    document.addEventListener("pointerlockchange", onLockChange);

    document.body.classList.add("game-active");
    return () => {
      document.removeEventListener("pointerlockchange", onLockChange);
      document.body.classList.remove("game-active");
      game.dispose();
      gameRef.current = null;
    };
  }, [mode, net, seed]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {!locked && !spectating && (
        <div
          className="absolute inset-0 z-20 flex cursor-pointer items-center justify-center bg-black/70 text-center"
          onClick={() => gameRef.current?.resume()}
        >
          <div className="select-none">
            <div className="mb-3 text-2xl font-black tracking-widest text-neon">
              CLICK TO LOOK AROUND
            </div>
            <div className="text-sm text-white/60">
              WASD move · mouse look · click shoot · F flashlight · R reload · E
              interact
            </div>
            <div className="mt-2 text-xs text-white/35">Press ESC to release the cursor</div>
          </div>
        </div>
      )}
    </>
  );
}
