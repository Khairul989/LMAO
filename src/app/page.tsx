import Link from "next/link";

export default function Home() {
  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black text-white">
      {/* animated background grid + glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,46,196,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(25,227,255,0.10) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at 50% 40%, black 30%, transparent 75%)",
          }}
        />
      </div>
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-neon/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-cyber/10 blur-[120px]" />

      <div className="crt vignette relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.5em] text-cyber/80">
          A definitely-licensed™ experience
        </p>

        <h1 className="select-none text-7xl font-black leading-none tracking-tighter sm:text-8xl md:text-9xl">
          <span className="bg-gradient-to-br from-neon via-fuchsia-400 to-cyber bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(255,46,196,0.5)]">
            LMAO
          </span>
        </h1>
        <p className="mt-2 text-lg font-medium text-white/70 sm:text-xl">
          <span className="text-brass">L</span>ast{" "}
          <span className="text-brass">M</span>ortals{" "}
          <span className="text-brass">A</span>live:{" "}
          <span className="text-brass">O</span>nline
        </p>

        <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">
          The <span className="font-semibold text-neon">Temu™ League of Legends</span>.
          Trapped in a haunted house with a thing that only moves in the dark. Keep
          it in your flashlight to freeze it. Find <span className="text-brass">3 brass keys</span>,
          reach the front door, and get out. Solo, or drag your friends in by sharing a room code.
        </p>

        <Link
          href="/play"
          className="group relative mt-10 inline-flex items-center gap-3 rounded-xl border border-neon/50 bg-neon/10 px-10 py-4 text-lg font-bold uppercase tracking-widest text-white transition hover:bg-neon/20 hover:shadow-[0_0_40px_rgba(255,46,196,0.45)]"
        >
          <span className="animate-pulseBar text-toxic">▶</span>
          Play Now
        </Link>

        <div className="mt-12 grid max-w-2xl grid-cols-2 gap-4 text-left text-xs text-white/50 sm:grid-cols-4">
          <Feature title="🔦 Freeze Rule" desc="Light it = it stops. Look away = it sprints." />
          <Feature title="🔑 3 Keys" desc="Hidden across 5 rooms. Then escape." />
          <Feature title="🌐 Co-op Rooms" desc="Host a room, share the code, survive together." />
          <Feature title="🎧 Pure Synth" desc="Every sound generated live. Headphones on." />
        </div>

        <p className="mt-10 text-[10px] uppercase tracking-[0.3em] text-white/30">
          WASD move · mouse look · click shoot · F flashlight · R reload · E interact
        </p>
      </div>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <div className="mb-1 font-semibold text-white/80">{title}</div>
      <div className="leading-snug">{desc}</div>
    </div>
  );
}
