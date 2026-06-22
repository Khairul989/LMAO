import Peer, { type DataConnection } from "peerjs";
import { NET } from "@/game/config";
import type {
  Mode,
  NetEvent,
  NetSnapshot,
  PickupKindNet,
  RemoteState,
} from "@/game/types";

export interface NetCallbacks {
  onPlayerJoin(id: string): void;
  onPlayerLeave(id: string): void;
  onRemoteState(s: RemoteState): void;
  onSnapshot(s: NetSnapshot): void;
  onShoot(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    from: string,
  ): void;
  onStart(seed: number): void;
  onPickup(kind: PickupKindNet, index: number, from: string): void;
  onDeath(id: string): void;
  onWin(): void;
  onEscape(from: string): void;
  onDescend(level: number): void;
  onHit(dmg: number): void;
}

export interface NetManager {
  mode: Mode;
  selfId: string;
  roomCode: string;
  peers(): string[];
  host(cb: NetCallbacks): Promise<string>;
  join(code: string, cb: NetCallbacks): Promise<void>;
  startSolo(): void;
  setCallbacks(cb: NetCallbacks): void;
  sendState(s: RemoteState): void;
  sendShoot(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
  ): void;
  sendPickup(kind: PickupKindNet, index: number): void;
  sendDeath(id: string): void;
  sendWin(): void;
  sendEscape(): void;
  sendDescend(level: number): void;
  broadcastSnapshot(s: NetSnapshot): void;
  sendStart(seed: number): void;
  isHost(): boolean;
  dispose(): void;
}

const CONNECT_TIMEOUT = 14000;

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let s = "";
  for (let i = 0; i < 4; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function createNet(): NetManager {
  let peer: Peer | null = null;
  let mode: Mode = "solo";
  const conns = new Map<string, DataConnection>();
  let cb: NetCallbacks | null = null;
  let hostConn: DataConnection | null = null; // client -> host link

  const nm: NetManager = {
    mode: "solo",
    selfId: "solo-" + Math.random().toString(36).slice(2, 8),
    roomCode: "",
    peers: () => Array.from(conns.keys()),
    isHost: () => mode === "host",

    startSolo() {
      mode = "solo";
      nm.mode = "solo";
    },

    setCallbacks(callbacks) {
      cb = callbacks;
    },

    host(callbacks) {
      cb = callbacks;
      mode = "host";
      nm.mode = "host";
      const code = randomCode();
      nm.roomCode = code;
      const id = `${NET.brokerPrefix}-${code}`;
      return new Promise<string>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Broker timeout — could not reach signaling server."));
          }
        }, CONNECT_TIMEOUT);

        try {
          peer = new Peer(id);
        } catch (e) {
          clearTimeout(timer);
          reject(e as Error);
          return;
        }

        peer.on("open", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          nm.selfId = id;
          resolve(code);
        });

        peer.on("connection", (conn) => {
          conn.on("open", () => {
            conns.set(conn.peer, conn);
            cb?.onPlayerJoin(conn.peer);
          });
          conn.on("data", (data) => handleHostData(conn, data as NetEvent));
          conn.on("close", () => {
            conns.delete(conn.peer);
            cb?.onPlayerLeave(conn.peer);
          });
          conn.on("error", () => {
            conns.delete(conn.peer);
          });
        });

        peer.on("error", (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
      });
    },

    join(code, callbacks) {
      cb = callbacks;
      mode = "join";
      nm.mode = "join";
      const cleanCode = code.trim().toUpperCase();
      nm.roomCode = cleanCode;
      const hostId = `${NET.brokerPrefix}-${cleanCode}`;
      return new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Could not connect to room — check the code."));
          }
        }, CONNECT_TIMEOUT);

        try {
          peer = new Peer();
        } catch (e) {
          clearTimeout(timer);
          reject(e as Error);
          return;
        }

        peer.on("open", (myId) => {
          nm.selfId = myId;
          const conn = peer!.connect(hostId, { reliable: true });
          hostConn = conn;
          conn.on("open", () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            conns.set(hostId, conn);
            conn.send({ t: "hello", id: myId, name: myId.slice(0, 6) } as NetEvent);
            resolve();
          });
          conn.on("data", (data) => handleClientData(data as NetEvent));
          conn.on("close", () => {
            cb?.onPlayerLeave(hostId);
          });
          conn.on("error", () => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(new Error("Room connection failed."));
            }
          });
        });

        peer.on("error", (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        });
      });
    },

    sendState(s) {
      if (mode === "host") {
        broadcast({ t: "state", s });
      } else if (mode === "join" && hostConn?.open) {
        hostConn.send({ t: "state", s } as NetEvent);
      }
    },

    sendShoot(ox, oy, oz, dx, dy, dz) {
      if (mode === "join" && hostConn?.open) {
        hostConn.send({ t: "shoot", ox, oy, oz, dx, dy, dz } as NetEvent);
      }
    },

    sendPickup(kind, index) {
      if (mode === "join" && hostConn?.open) {
        hostConn.send({ t: "pickup", kind, index } as NetEvent);
      }
    },

    sendDeath(id) {
      // per-player death (spectator model): announce who died; nobody else dies.
      if (mode === "host") broadcast({ t: "death", id });
      else if (mode === "join" && hostConn?.open)
        hostConn.send({ t: "death", id } as NetEvent);
    },

    sendWin() {
      // team extract: anyone escaping wins it for the whole room.
      if (mode === "host") broadcast({ t: "win" });
      else if (mode === "join" && hostConn?.open)
        hostConn.send({ t: "win" } as NetEvent);
    },

    sendEscape() {
      // client reached the door with the keys -> ask the host to descend the room
      if (mode === "join" && hostConn?.open)
        hostConn.send({ t: "escape" } as NetEvent);
    },

    sendDescend(level) {
      // host authoritatively drops everyone to the next floor
      if (mode === "host") broadcast({ t: "descend", level });
    },

    broadcastSnapshot(s) {
      if (mode === "host") broadcast({ t: "snapshot", s });
    },

    sendStart(seed) {
      if (mode === "host") broadcast({ t: "start", seed });
    },

    dispose() {
      conns.forEach((c) => {
        try {
          c.close();
        } catch {
          /* noop */
        }
      });
      conns.clear();
      hostConn = null;
      if (peer) {
        try {
          peer.destroy();
        } catch {
          /* noop */
        }
        peer = null;
      }
      cb = null;
    },
  };

  function broadcast(ev: NetEvent, except?: string) {
    conns.forEach((c, id) => {
      if (id !== except && c.open) c.send(ev);
    });
  }

  function handleHostData(conn: DataConnection, ev: NetEvent) {
    switch (ev.t) {
      case "hello":
        // already tracked on connection open
        break;
      case "state":
        cb?.onRemoteState(ev.s);
        broadcast(ev, conn.peer); // relay to other clients
        break;
      case "shoot":
        cb?.onShoot(ev.ox, ev.oy, ev.oz, ev.dx, ev.dy, ev.dz, conn.peer);
        break;
      case "pickup":
        cb?.onPickup(ev.kind, ev.index, conn.peer);
        break;
      case "death":
        // a teammate died -> mark them down (spectator model) and relay to others
        cb?.onDeath(ev.id);
        broadcast(ev, conn.peer);
        break;
      case "win":
        cb?.onWin();
        broadcast(ev, conn.peer);
        break;
      case "escape":
        // client requests a descent; host adjudicates (does not relay raw request)
        cb?.onEscape(conn.peer);
        break;
      default:
        break;
    }
  }

  function handleClientData(ev: NetEvent) {
    switch (ev.t) {
      case "state":
        cb?.onRemoteState(ev.s);
        break;
      case "snapshot":
        cb?.onSnapshot(ev.s);
        break;
      case "start":
        cb?.onStart(ev.seed);
        break;
      case "death":
        cb?.onDeath(ev.id);
        break;
      case "win":
        cb?.onWin();
        break;
      case "descend":
        cb?.onDescend(ev.level);
        break;
      case "hit":
        cb?.onHit(ev.dmg);
        break;
      default:
        break;
    }
  }

  return nm;
}
