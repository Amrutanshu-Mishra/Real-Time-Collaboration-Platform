import WebSocket, { WebSocketServer } from "ws";
import { URL } from "url";
import * as Y from "yjs";

const wss = new WebSocketServer({ port: 8080 });

// ── Logging ─────────────────────────────────────────────────────────────

function log(tag, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length
    ? " " + JSON.stringify(meta)
    : "";
  console.log(`[${timestamp}] [${tag}]  ${message}${metaStr}`);
}

// ── Room State ──────────────────────────────────────────────────────────
// rooms: Map<docId, { doc: Y.Doc, clients: Map<WebSocket, UserInfo> }>
//
// Each room holds:
//   • doc      – server-side Y.Doc that is the source of truth for the document
//   • clients  – all WebSocket connections currently in this room
//
// The server applies every incoming Yjs update to its own Y.Doc so it
// always holds the latest CRDT state.  When a new client joins it receives
// the full document state immediately, meaning clients no longer need to
// rely on other peers being online.

const rooms = new Map();

const AVATAR_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
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

/** Get or create a room for the given docId */
function getOrCreateRoom(docId) {
  if (!rooms.has(docId)) {
    const doc = new Y.Doc();
    rooms.set(docId, { doc, clients: new Map() });
    log("ROOM", `Created room`, { docId, totalRooms: rooms.size });
  }
  return rooms.get(docId);
}

/** Build the presence list for a specific room */
function getPresenceList(docId) {
  const room = rooms.get(docId);
  if (!room) return [];
  return Array.from(room.clients.values());
}

/** Broadcast a JSON presence update to all clients in a room */
function broadcastPresence(docId) {
  const room = rooms.get(docId);
  if (!room) return;

  const users = getPresenceList(docId);
  const payload = JSON.stringify({
    type: "presence-update",
    users,
  });

  let sentCount = 0;
  room.clients.forEach((_, client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sentCount++;
    }
  });

  log("PRESENCE", `Broadcast to room`, {
    docId,
    onlineUsers: users.length,
    sentTo: sentCount,
  });
}

/**
 * When the last client leaves, the room is NOT deleted.
 * The Y.Doc stays in server memory so that a future client
 * joining the same docId will receive the full document state.
 */
function onRoomEmpty(docId) {
  const room = rooms.get(docId);
  if (room && room.clients.size === 0) {
    log("ROOM", `Room is now empty but persisted in memory`, {
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

// ── Connection Handler ──────────────────────────────────────────────────
wss.on("connection", (ws, req) => {
  // ── 1. Parse docId from query string ──────────────────────────────────
  const url = new URL(req.url, `http://${req.headers.host}`);
  const docId = url.searchParams.get("docId") || "default";

  // ── 2. Assign identity ────────────────────────────────────────────────
  const userInfo = {
    userId: generateUserId(),
    name: generateUserName(),
    color: pickColor(),
  };

  // ── 3. Join the room ──────────────────────────────────────────────────
  const room = getOrCreateRoom(docId);
  room.clients.set(ws, userInfo);
  log("JOIN", `${userInfo.name} joined`, {
    docId,
    userId: userInfo.userId,
    roomSize: room.clients.size,
  });

  // ── 4. Send the client their own identity ─────────────────────────────
  ws.send(
    JSON.stringify({
      type: "user-info",
      user: userInfo,
    })
  );

  // ── 5. Send the full document state to the new client ─────────────────
  //    This is the key persistence feature: the server holds the latest
  //    CRDT state and sends it on join, so new clients are immediately
  //    up-to-date even if no other peers are online.
  const stateVector = Y.encodeStateAsUpdate(room.doc);
  if (stateVector.length > 0) {
    const syncMessage = new Uint8Array(stateVector.length + 1);
    syncMessage[0] = 0; // type 0 = doc update
    syncMessage.set(stateVector, 1);
    ws.send(syncMessage);
    log("SYNC", `Sent full doc state to new client`, {
      docId,
      bytes: stateVector.length,
      to: userInfo.name,
    });
  }

  // ── 6. Broadcast updated presence to everyone in this room ────────────
  broadcastPresence(docId);
  logRoomSnapshot();

  // ── 7. Handle incoming messages — route through the room ──────────────
  ws.on("message", (message, isBinary) => {
    if (isBinary) {
      const raw = Buffer.isBuffer(message) ? message : Buffer.from(message);
      const byteLength = raw.length;

      if (byteLength < 2) return; // need at least header + 1 byte payload

      const messageType = raw[0];
      const payload = raw.subarray(1);

      if (messageType === 0) {
        // ── Doc update ────────────────────────────────────────────────
        // Apply to the server's Y.Doc so it always holds the latest state
        try {
          Y.applyUpdate(room.doc, payload);
          log("DOC", `Applied update to server Y.Doc`, {
            docId,
            bytes: payload.length,
            from: userInfo.name,
          });
        } catch (err) {
          log("ERROR", `Failed to apply Yjs update`, {
            docId,
            from: userInfo.name,
            error: err.message,
          });
        }
      }

      // Forward the original binary message to all OTHER clients in the room
      let forwardedCount = 0;
      room.clients.forEach((_, client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message);
          forwardedCount++;
        }
      });

      log("ROUTE", `Binary update routed within room`, {
        docId,
        type: messageType === 0 ? "doc" : "awareness",
        bytes: byteLength,
        from: userInfo.name,
        forwardedTo: forwardedCount,
      });
    } else {
      // Text/JSON messages
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

  // ── 8. Handle disconnect ──────────────────────────────────────────────
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

  // ── 9. Handle errors ──────────────────────────────────────────────────
  ws.on("error", (err) => {
    log("ERROR", `WebSocket error for ${userInfo.name}`, {
      docId,
      userId: userInfo.userId,
      error: err.message,
    });
  });
});

log("SERVER", "WebSocket gateway running on ws://localhost:8080");
