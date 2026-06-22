import { create } from "zustand";
import { AMMO, FLASHLIGHT, KEYS } from "@/game/config";
import type { HudState, Mode, Phase } from "@/game/types";

const initialHud: HudState = {
  battery: FLASHLIGHT.maxBattery,
  flashlightOn: true,
  ammo: AMMO.start,
  maxAmmo: AMMO.max,
  reserveAmmo: AMMO.reserve,
  keysFound: 0,
  health: 100,
  level: 1,
  monsterFrozen: false,
  toast: "",
  prompt: "",
  nearDoor: false,
  remotePlayers: 0,
  fps: 0,
  spectating: false,
  spectateName: "",
};

export interface GameStore extends HudState {
  phase: Phase;
  mode: Mode;
  roomCode: string;
  keysTotal: number;
  set: (p: Partial<HudState>) => void;
  setPhase: (p: Phase) => void;
  setMode: (m: Mode) => void;
  setRoomCode: (c: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialHud,
  phase: "menu",
  mode: "solo",
  roomCode: "",
  keysTotal: KEYS.count,
  set: (p) => set(p),
  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),
  setRoomCode: (roomCode) => set({ roomCode }),
  reset: () => set({ ...initialHud }),
}));

// Non-react accessor for the game loop (avoids hook overhead in RAF).
export const gameStore = useGameStore;
