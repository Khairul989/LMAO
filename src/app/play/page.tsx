"use client";

import dynamic from "next/dynamic";

// The game touches window/WebGL — never SSR it.
const GameShell = dynamic(() => import("@/components/GameShell"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-black text-white/60">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 spin rounded-full border-2 border-neon border-t-transparent" />
        Loading the dark…
      </div>
    </div>
  ),
});

export default function PlayPage() {
  return <GameShell />;
}
