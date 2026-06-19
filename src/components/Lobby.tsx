"use client";

import { useState } from "react";
import { useGameStore } from "@/game/state/store";
import type { Mode } from "@/game/types";

export default function Lobby({
  mode,
  players,
  onStart,
  onCancel,
}: {
  mode: Mode;
  players: string[];
  onStart: () => void;
  onCancel: () => void;
}) {
  const roomCode = useGameStore((s) => s.roomCode);
  const isHost = mode === "host";
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — code is on screen anyway */
    }
  };

  return (
    <div className="crt vignette absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 px-6">
      <h2 className="mb-2 text-sm uppercase tracking-[0.4em] text-white/40">
        {isHost ? "Your Co-op Room" : "Joining Room"}
      </h2>

      <button
        onClick={copy}
        title="Click to copy"
        className="group relative mb-2 rounded-2xl border border-neon/50 bg-neon/5 px-12 py-6 text-7xl font-black tracking-[0.3em] text-neon transition hover:bg-neon/10 hover:shadow-[0_0_50px_rgba(255,46,196,0.4)]"
      >
        {roomCode || "····"}
      </button>
      <p className="mb-8 text-xs uppercase tracking-widest text-white/40">
        {copied ? "Copied!" : isHost ? "Click code to copy · share it" : "Waiting for host to start…"}
      </p>

      <div className="mb-8 w-full max-w-sm rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-widest text-white/40">
          <span>Survivors</span>
          <span className="text-toxic">{players.length + 1} online</span>
        </div>
        <ul className="space-y-1 text-sm">
          <li className="flex items-center gap-2 text-white/80">
            <span className="h-2 w-2 rounded-full bg-toxic" />
            {isHost ? "You (Host)" : "You"}
          </li>
          {players.map((p) => (
            <li key={p} className="flex items-center gap-2 text-white/60">
              <span className="h-2 w-2 rounded-full bg-cyber" />
              {p.replace(/^LMAO-/, "").slice(0, 10)}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-3">
        {isHost && (
          <button
            onClick={onStart}
            className="rounded-lg border border-toxic/50 bg-toxic/10 px-10 py-3 font-bold uppercase tracking-widest text-white transition hover:bg-toxic/20 hover:shadow-[0_0_30px_rgba(124,255,91,0.35)]"
          >
            Start Game
          </button>
        )}
        {!isHost && (
          <div className="flex items-center gap-2 text-white/50">
            <span className="h-3 w-3 spin rounded-full border-2 border-cyber border-t-transparent" />
            Connected — standing by
          </div>
        )}
        <button
          onClick={onCancel}
          className="rounded-lg border border-white/20 px-6 py-3 text-sm uppercase tracking-widest text-white/60 transition hover:bg-white/10"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
