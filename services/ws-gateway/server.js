import WebSocket, { WebSocketServer } from "ws";
import { URL } from "url";

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
// rooms: Map<docId, { clients: Map<WebSocket, UserInfo> }>
//
// The server groups every WebSocket connection into a "room" identified by
// the docId the client sends during the handshake.  All Yjs CRDT updates
// and presence broadcasts are scoped to the room — there is ZERO cross-
// document traffic.

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
    rooms.set(docId, { clients: new Map() });
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

/** Remove a room if it has no clients left */
function cleanupRoom(docId) {
  const room = rooms.get(docId);
  if (room && room.clients.size === 0) {
    rooms.delete(docId);
    log("ROOM", `Deleted empty room`, { docId, totalRooms: rooms.size });
  }
}

/** Print a snapshot of all active rooms (useful for periodic debugging) */
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
  //    e.g. ws://localhost:8080?docId=my-doc
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

  // ── 5. Broadcast updated presence to everyone in this room ────────────
  broadcastPresence(docId);

  // Log a full snapshot after a join so the terminal shows the big picture
  logRoomSnapshot();

  // ── 6. Handle incoming messages — route through the room ──────────────
  ws.on("message", (message, isBinary) => {
    if (isBinary) {
      // Binary → Yjs CRDT / awareness update → forward to all clients
      // in the SAME room only (no cross-document traffic)
      const byteLength = message.length || message.byteLength || 0;
      let forwardedCount = 0;

      room.clients.forEach((_, client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
          forwardedCount++;
        }
      });

      log("ROUTE", `Binary update routed within room`, {
        docId,
        bytes: byteLength,
        from: userInfo.name,
        forwardedTo: forwardedCount,
      });
    } else {
      // Text/JSON messages — handle if needed
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

  // ── 7. Handle disconnect — remove from room and clean up ──────────────
  ws.on("close", () => {
    room.clients.delete(ws);
    log("LEAVE", `${userInfo.name} left`, {
      docId,
      userId: userInfo.userId,
      roomSize: room.clients.size,
    });

    broadcastPresence(docId);
    cleanupRoom(docId);

    // Show updated snapshot
    logRoomSnapshot();
  });

  // ── 8. Handle errors ──────────────────────────────────────────────────
  ws.on("error", (err) => {
    log("ERROR", `WebSocket error for ${userInfo.name}`, {
      docId,
      userId: userInfo.userId,
      error: err.message,
    });
  });
});

log("SERVER", "WebSocket gateway running on ws://localhost:8080");
