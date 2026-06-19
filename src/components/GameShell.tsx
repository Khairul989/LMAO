"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/game/state/store";
import { createNet, type NetManager } from "@/game/net/net";
import { randomSeed } from "@/game/rng";
import type { Mode } from "@/game/types";
import GameCanvas from "@/components/GameCanvas";
import Hud from "@/components/Hud";
import Menu from "@/components/Menu";
import Lobby from "@/components/Lobby";
import { DeathScreen, VictoryScreen, LoadingScreen } from "@/components/Screens";

export default function GameShell() {
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const setMode = useGameStore((s) => s.setMode);
  const setRoomCode = useGameStore((s) => s.setRoomCode);
  const reset = useGameStore((s) => s.reset);

  const netRef = useRef<NetManager | null>(null);
  if (!netRef.current) netRef.current = createNet();
  const net = netRef.current;

  const [mode, setLocalMode] = useState<Mode>("solo");
  const [seed, setSeed] = useState<number>(() => randomSeed());
  const [runId, setRunId] = useState(0);
  const [players, setPlayers] = useState<string[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setPhase("menu");
    return () => net.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // lobby callbacks: track players + (client) wait for host start
  const lobbyCallbacks = useMemo(
    () => ({
      onPlayerJoin: (id: string) => setPlayers((p) => [...new Set([...p, id])]),
      onPlayerLeave: (id: string) => setPlayers((p) => p.filter((x) => x !== id)),
      onRemoteState: () => {},
      onSnapshot: () => {},
      onShoot: () => {},
      onPickup: () => {},
      onStart: (s: number) => {
        setSeed(s);
        setRunId((r) => r + 1);
        setPhase("playing");
      },
      onHit: () => {},
    }),
    [setPhase],
  );

  const startSolo = useCallback(() => {
    reset();
    net.startSolo();
    setLocalMode("solo");
    setMode("solo");
    setSeed(randomSeed());
    setRunId((r) => r + 1);
    setPhase("playing");
  }, [net, reset, setMode, setPhase]);

  const startHost = useCallback(async () => {
    setError("");
    reset();
    setLocalMode("host");
    setMode("host");
    setPlayers([]);
    setPhase("lobby");
    try {
      const code = await net.host(lobbyCallbacks);
      setRoomCode(code);
    } catch (e) {
      setError(
        (e as Error).message || "Could not create room. Falling back to solo.",
      );
      setPhase("menu");
    }
  }, [net, reset, setMode, setPhase, setRoomCode, lobbyCallbacks]);

  const startJoin = useCallback(
    async (code: string) => {
      setError("");
      reset();
      setLocalMode("join");
      setMode("join");
      setPlayers([]);
      setRoomCode(code.toUpperCase());
      setPhase("lobby");
      try {
        await net.join(code, lobbyCallbacks);
      } catch (e) {
        setError((e as Error).message || "Could not join room.");
        setPhase("menu");
      }
    },
    [net, reset, setMode, setPhase, setRoomCode, lobbyCallbacks],
  );

  const hostStartGame = useCallback(() => {
    const s = randomSeed();
    setSeed(s);
    net.sendStart(s);
    setRunId((r) => r + 1);
    setPhase("playing");
  }, [net, setPhase]);

  const backToMenu = useCallback(() => {
    reset();
    net.dispose();
    netRef.current = createNet();
    setPlayers([]);
    setPhase("menu");
  }, [net, reset, setPhase]);

  const inGame = phase === "playing" || phase === "dead" || phase === "victory";

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black">
      {inGame && (
        <GameCanvas
          key={runId}
          mode={mode}
          net={netRef.current!}
          seed={seed}
        />
      )}
      {phase === "playing" && <Hud />}
      {phase === "menu" && (
        <Menu onSolo={startSolo} onHost={startHost} onJoin={startJoin} error={error} />
      )}
      {phase === "lobby" && (
        <Lobby
          mode={mode}
          players={players}
          onStart={hostStartGame}
          onCancel={backToMenu}
        />
      )}
      {phase === "loading" && <LoadingScreen />}
      {phase === "dead" && <DeathScreen onRestart={backToMenu} />}
      {phase === "victory" && <VictoryScreen onRestart={backToMenu} />}
    </main>
  );
}
