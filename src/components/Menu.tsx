"use client";

import { useState } from "react";

export default function Menu({
  onSolo,
  onHost,
  onJoin,
  error,
}: {
  onSolo: () => void;
  onHost: () => void;
  onJoin: (code: string) => void;
  error?: string;
}) {
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");

  return (
    <div className="crt vignette absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 px-6">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-neon/15 blur-[130px]" />

      <h1 className="relative select-none text-6xl font-black tracking-tighter sm:text-7xl">
        <span className="bg-gradient-to-br from-neon via-fuchsia-400 to-cyber bg-clip-text text-transparent">
          LMAO
        </span>
      </h1>
      <p className="mb-10 mt-1 text-sm uppercase tracking-[0.35em] text-white/50">
        Last Mortals Alive: Online
      </p>

      {error && (
        <div className="mb-6 max-w-md rounded-lg border border-blood/50 bg-blood/10 px-4 py-2 text-center text-sm text-red-200">
          {error}
        </div>
      )}

      {!joining ? (
        <div className="grid w-full max-w-md gap-4">
          <MenuButton
            title="Solo Survival"
            sub="Just you and it. Find the keys. Escape."
            accent="toxic"
            onClick={onSolo}
          />
          <MenuButton
            title="Host Co-op Room"
            sub="Create a room and share the code with friends."
            accent="neon"
            onClick={onHost}
          />
          <MenuButton
            title="Join a Room"
            sub="Got a 4-letter code? Drop in."
            accent="cyber"
            onClick={() => setJoining(true)}
          />
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <input
            autoFocus
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 4) onJoin(code);
            }}
            placeholder="CODE"
            className="w-56 rounded-xl border border-cyber/50 bg-black/60 px-4 py-4 text-center text-4xl font-black tracking-[0.4em] text-cyber outline-none focus:border-cyber focus:shadow-[0_0_30px_rgba(25,227,255,0.4)]"
          />
          <div className="flex gap-3">
            <button
              disabled={code.length !== 4}
              onClick={() => onJoin(code)}
              className="rounded-lg border border-cyber/50 bg-cyber/10 px-8 py-3 font-bold uppercase tracking-widest text-white transition hover:bg-cyber/20 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Connect
            </button>
            <button
              onClick={() => setJoining(false)}
              className="rounded-lg border border-white/20 px-6 py-3 text-sm uppercase tracking-widest text-white/60 transition hover:bg-white/10"
            >
              Back
            </button>
          </div>
        </div>
      )}

      <p className="mt-10 text-[11px] uppercase tracking-[0.3em] text-white/30">
        WASD · mouse · click · F · R · E — 🎧 headphones recommended
      </p>
    </div>
  );
}

function MenuButton({
  title,
  sub,
  accent,
  onClick,
}: {
  title: string;
  sub: string;
  accent: "toxic" | "neon" | "cyber";
  onClick: () => void;
}) {
  const ring = {
    toxic: "border-toxic/40 hover:bg-toxic/10 hover:shadow-[0_0_30px_rgba(124,255,91,0.3)]",
    neon: "border-neon/40 hover:bg-neon/10 hover:shadow-[0_0_30px_rgba(255,46,196,0.3)]",
    cyber: "border-cyber/40 hover:bg-cyber/10 hover:shadow-[0_0_30px_rgba(25,227,255,0.3)]",
  }[accent];
  const text = { toxic: "text-toxic", neon: "text-neon", cyber: "text-cyber" }[accent];
  return (
    <button
      onClick={onClick}
      className={`group rounded-xl border bg-white/5 px-6 py-5 text-left transition ${ring}`}
    >
      <div className={`text-xl font-bold ${text}`}>{title}</div>
      <div className="mt-1 text-sm text-white/55">{sub}</div>
    </button>
  );
}
