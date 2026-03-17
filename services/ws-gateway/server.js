import WebSocket, { WebSocketServer } from "ws";
import { URL } from "url";
import * as Y from "yjs";
import Redis from "ioredis";

import { connectDB } from "./db/connection.js";
import { trackUpdate, forceSnapshot } from "./snapshotSystem.js";
import {
  rooms,
  getOrCreateRoom,
  evictRoom,
} from "./documentManager.js";

// ── Logging ─────────────────────────────────────────────────────────────
function log(tag, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length
    ? " " + JSON.stringify(meta)
    : "";
  console.log(`[${timestamp}] [${tag}]  ${message}${metaStr}`);
}

// ── Redis (publisher + subscriber) ──────────────────────────────────────
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const redisPublisher = new Redis(REDIS_URL);
const redisSubscriber = new Redis(REDIS_URL);

// Unique ID for this server instance — used to skip self-echo on Redis.
const SERVER_ID = `srv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ── Message type constants ──────────────────────────────────────────────
const MSG_TYPE_DOC = 0;       // CRDT document update
const MSG_TYPE_AWARENESS = 1; // Cursor / presence awareness update

const DOC_CHANNEL_PREFIX = "doc:";
function docChannel(docId) {
  return `${DOC_CHANNEL_PREFIX}${docId}`;
}

/** Channels we're already subscribed to (avoid double-subscribe) */
const subscribedChannels = new Set();

function ensureSubscribedToDoc(docId) {
  const ch = docChannel(docId);
  if (subscribedChannels.has(ch)) return;
  subscribedChannels.add(ch);
  redisSubscriber.subscribe(ch, (err) => {
    if (err)
      log("REDIS", "Subscribe error", { channel: ch, error: err.message });
    else log("REDIS", "Subscribed to channel", { channel: ch });
  });
}

redisPublisher.on("error", (err) =>
  log("REDIS", "Publisher error", { error: err.message })
);
redisSubscriber.on("error", (err) =>
  log("REDIS", "Subscriber error", { error: err.message })
);

// ── Pipeline Stage 4 ─ Redis Subscriber ─────────────────────────────────
//
// Flow: client → WS → Y.Doc → Redis Pub/Sub → Snapshot System → MongoDB
//
// This handler receives updates published to Redis by OTHER server
// instances. It applies them to the local Y.Doc, broadcasts to local
// clients, and feeds into the Snapshot System (last pipeline stage).
redisSubscriber.on("messageBuffer", (channelBuf, messageBuf) => {
  const channel = channelBuf.toString();
  if (!channel.startsWith(DOC_CHANNEL_PREFIX)) return;
  const docId = channel.slice(DOC_CHANNEL_PREFIX.length);

  // ── Skip self-echo ────────────────────────────────────────────────────
  // We tag every publish with our SERVER_ID. If we receive our own
  // message back we skip it — the local Y.Doc already has the update.
  const raw = Buffer.isBuffer(messageBuf) ? messageBuf : Buffer.from(messageBuf);

  // Envelope: [serverId_length (1 byte)] [serverId bytes] [yjs payload]
  const idLen = raw[0];
  const originId = raw.slice(1, 1 + idLen).toString();
  if (originId === SERVER_ID) return; // skip self-echo

  const payload = raw.slice(1 + idLen);

  // ── Load-then-apply guarantee ─────────────────────────────────────────
  getOrCreateRoom(docId, ensureSubscribedToDoc).then((room) => {
    try {
      Y.applyUpdate(room.doc, payload);
    } catch (err) {
      log("REDIS", "Failed to apply Yjs update from Redis", {
        docId,
        error: err.message,
      });
      return;
    }

    // In-memory update log
    room.updateLog.push(new Uint8Array(payload));

    // Broadcast to local clients (optimised loop)
    const fullMessage = Buffer.concat([Buffer.from([MSG_TYPE_DOC]), payload]);
    let sentCount = 0;
    for (const [client] of room.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(fullMessage);
        sentCount++;
      }
    }

    // ── Snapshot System (pipeline stage 5) ──
    trackUpdate(room, docId);

    log("REDIS", "Applied, broadcast, and tracked for snapshot", {
      docId,
      bytes: payload.length,
      sentTo: sentCount,
    });
  }).catch((err) => {
    log("REDIS", "Failed to load room before applying update", {
      docId,
      error: err.message,
    });
  });
});

// ── Room State (managed by documentManager.js) ──────────────────────────
//
// rooms: Map<docId, {
//   doc: Y.Doc,
//   clients: Map<WebSocket, UserInfo>,
//   updateCount: number,
//   lastSnapshotAt: number,
//   lastActivityAt: number,
//   updateLog: Uint8Array[]
// }>
// Imported from documentManager — do NOT declare a local `rooms` here.

// ── Room garbage collection ─────────────────────────────────────────────
const ROOM_IDLE_TTL_MS = Number(process.env.ROOM_IDLE_TTL_MS || 10 * 60 * 1000);
const ROOM_GC_INTERVAL_MS = Number(process.env.ROOM_GC_INTERVAL_MS || 60 * 1000);

function gcRooms() {
  if (ROOM_IDLE_TTL_MS <= 0) return;
  const now = Date.now();
  let removed = 0;
  for (const [docId, room] of rooms.entries()) {
    const last = room.lastActivityAt || 0;
    if (room.clients.size === 0 && now - last >= ROOM_IDLE_TTL_MS) {
      // evictRoom handles snapshot + removal from both maps
      evictRoom(docId);
      removed++;
    }
  }
  if (removed > 0) {
    log("GC", "Rooms garbage collected", { removed, totalRooms: rooms.size });
  }
}

if (ROOM_GC_INTERVAL_MS > 0) {
  setInterval(gcRooms, ROOM_GC_INTERVAL_MS);
}

// ── Identity helpers ────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

let userCounter = 0;

function generateUserId() {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function generateUserName() {
  userCounter++;
  return `User-${String(userCounter).padStart(4, "0")}`;
}

function pickColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// ── Room helpers ────────────────────────────────────────────────────────
//
// getOrCreateRoom, rooms, and evictRoom are provided by documentManager.js.
// This server passes `ensureSubscribedToDoc` as the onFirstLoad callback so
// each new room is automatically wired up to its Redis channel exactly once.

/** Build the presence list for a specific room */
function getPresenceList(docId) {
  const room = rooms.get(docId);
  if (!room) return [];
  return Array.from(room.clients.values());
}

/** Broadcast a JSON presence update to all clients in a room (debounced) */
const PRESENCE_DEBOUNCE_MS = 100;
const presenceTimers = new Map(); // Map<docId, timer>

function broadcastPresence(docId) {
  // Debounce: collapse a burst of join/leave events into one broadcast
  if (presenceTimers.has(docId)) {
    clearTimeout(presenceTimers.get(docId));
  }
  presenceTimers.set(
    docId,
    setTimeout(() => {
      presenceTimers.delete(docId);
      _doBroadcastPresence(docId);
    }, PRESENCE_DEBOUNCE_MS)
  );
}

function _doBroadcastPresence(docId) {
  const room = rooms.get(docId);
  if (!room) return;

  const users = getPresenceList(docId);
  const payload = JSON.stringify({ type: "presence-update", users });

  let sentCount = 0;
  for (const [client] of room.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sentCount++;
    }
  }

  log("PRESENCE", `Broadcast to room`, {
    docId,
    onlineUsers: users.length,
    sentTo: sentCount,
  });
}

/**
 * When the last client leaves, force-save a snapshot via the Snapshot System
 * so the latest state is always persisted in MongoDB.
 * The room is kept in memory (GC will evict it if it stays idle).
 */
function onRoomEmpty(docId) {
  const room = rooms.get(docId);
  if (room && room.clients.size === 0) {
    forceSnapshot(room, docId);
    log("ROOM", "Room empty — snapshot saved, kept in memory", {
      docId,
      totalRooms: rooms.size,
    });
  }
}

/** Print a snapshot of all active rooms */
function logRoomSnapshot() {
  if (rooms.size === 0) {
    log("SNAPSHOT", "No active rooms");
    return;
  }
  const summary = {};
  for (const [docId, room] of rooms.entries()) {
    summary[docId] = {
      clients: room.clients.size,
      users: Array.from(room.clients.values()).map((u) => u.name),
    };
  }
  log("SNAPSHOT", "Active rooms", summary);
}

// ── Bootstrap ───────────────────────────────────────────────────────────
//
// Pipeline: client → WebSocket Server → server Y.Doc → Redis Pub/Sub
//                                                       → Snapshot System → MongoDB
//
// 1. Connect to MongoDB (persistence layer)
// 2. Start the WebSocket server (entry point for clients)
async function startServer() {
  await connectDB();

  const wss = new WebSocketServer({ port: 8080 });

  wss.on("connection", async (ws, req) => {
    // ── Stage 1: Client connects via WebSocket ────────────────────────────
    const url = new URL(req.url, `http://${req.headers.host}`);
    const docId = url.searchParams.get("docId") || "default";

    const userInfo = {
      userId: generateUserId(),
      name: generateUserName(),
      color: pickColor(),
    };

    // Load room (lazy-loaded with single-flight dedup via documentManager)
    const room = await getOrCreateRoom(docId, ensureSubscribedToDoc);
    room.clients.set(ws, userInfo);
    log("JOIN", `${userInfo.name} joined`, {
      docId,
      userId: userInfo.userId,
      roomSize: room.clients.size,
    });

    // Send identity
    ws.send(JSON.stringify({ type: "user-info", user: userInfo }));

    // Send full document state to new client
    const stateVector = Y.encodeStateAsUpdate(room.doc);
    if (stateVector.length > 0) {
      const syncMessage = new Uint8Array(stateVector.length + 1);
      syncMessage[0] = 0;
      syncMessage.set(stateVector, 1);
      ws.send(syncMessage);
      log("SYNC", `Sent full doc state to new client`, {
        docId,
        bytes: stateVector.length,
        to: userInfo.name,
      });
    }

    broadcastPresence(docId);
    logRoomSnapshot();

    // ── Stage 2–5: Handle incoming messages through the pipeline ──────────
    ws.on("message", (message, isBinary) => {
      if (isBinary) {
        const raw = Buffer.isBuffer(message) ? message : Buffer.from(message);
        if (raw.length < 2) return;

        const messageType = raw[0];
        const payload = raw.subarray(1);

        switch (messageType) {
          case MSG_TYPE_DOC: {
            // ── Stage 2: Apply CRDT update to server Y.Doc ──
            try {
              Y.applyUpdate(room.doc, payload);
              room.updateLog.push(new Uint8Array(payload));
              log("DOC", `Applied CRDT update to server Y.Doc`, {
                docId,
                bytes: payload.length,
                from: userInfo.name,
              });
            } catch (err) {
              log("ERROR", `Failed to apply Yjs CRDT update`, {
                docId,
                from: userInfo.name,
                error: err.message,
              });
              return;
            }

            // Broadcast to local clients (optimised for..of)
            let docForwardCount = 0;
            for (const [client] of room.clients) {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
                docForwardCount++;
              }
            }

            // ── Stage 3: Publish to Redis Pub/Sub (tagged with SERVER_ID) ──
            const idBuf = Buffer.from(SERVER_ID);
            const envelope = Buffer.concat([
              Buffer.from([idBuf.length]),
              idBuf,
              payload,
            ]);
            redisPublisher.publish(docChannel(docId), envelope).catch((err) => {
              log("REDIS", "Publish error", { docId, error: err.message });
            });

            // ── Stage 4 & 5: Snapshot System → MongoDB ──
            trackUpdate(room, docId);

            log("ROUTE", `Pipeline complete: Y.Doc → Redis → Snapshot`, {
              docId,
              bytes: raw.length,
              from: userInfo.name,
              forwardedTo: docForwardCount,
            });
            break;
          }

          case MSG_TYPE_AWARENESS: {
            // Awareness: forward to local clients only — no CRDT pipeline
            let awarenessForwardCount = 0;
            for (const [client] of room.clients) {
              if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
                awarenessForwardCount++;
              }
            }
            log("AWARENESS", `Cursor/presence update routed within room`, {
              docId,
              bytes: raw.length,
              from: userInfo.name,
              forwardedTo: awarenessForwardCount,
            });
            break;
          }

          default:
            log("WARN", `Unknown binary message type ${messageType}`, {
              docId,
              from: userInfo.name,
            });
        }
      } else {
        try {
          const msg = JSON.parse(message.toString());
          log("MSG", `JSON message received`, {
            docId,
            from: userInfo.name,
            type: msg.type || "unknown",
          });
        } catch {
          log("MSG", `Non-JSON text message received (ignored)`, {
            docId,
            from: userInfo.name,
          });
        }
      }
    });

    ws.on("close", () => {
      room.clients.delete(ws);
      log("LEAVE", `${userInfo.name} left`, {
        docId,
        userId: userInfo.userId,
        roomSize: room.clients.size,
      });
      broadcastPresence(docId);
      onRoomEmpty(docId);
      logRoomSnapshot();
    });

    ws.on("error", (err) => {
      log("ERROR", `WebSocket error for ${userInfo.name}`, {
        docId,
        userId: userInfo.userId,
        error: err.message,
      });
    });
  });

  log("SERVER", "WebSocket gateway running on ws://localhost:8080");
}

startServer().catch((err) => {
  console.error("[FATAL] Server failed to start:", err.message);
  process.exit(1);
});
