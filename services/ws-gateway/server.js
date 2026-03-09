import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

// ── Presence State ──────────────────────────────────────────────────────
// Maps each WebSocket connection to its user info
const clients = new Map(); // Map<WebSocket, { userId, name, color }>

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

/** Build the full presence list from the clients map */
function getPresenceList() {
  const users = [];
  for (const info of clients.values()) {
    users.push(info);
  }
  return users;
}

/** Broadcast a JSON message to all connected clients */
function broadcastPresence() {
  const payload = JSON.stringify({
    type: "presence-update",
    users: getPresenceList(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ── Connection Handler ──────────────────────────────────────────────────
wss.on("connection", (ws) => {
  // 1. Assign identity
  const userInfo = {
    userId: generateUserId(),
    name: generateUserName(),
    color: pickColor(),
  };

  clients.set(ws, userInfo);
  console.log(`${userInfo.name} connected (${userInfo.userId})`);

  // 2. Send the client their own identity
  ws.send(
    JSON.stringify({
      type: "user-info",
      user: userInfo,
    })
  );

  // 3. Broadcast updated presence to everyone
  broadcastPresence();

  // 4. Handle incoming messages
  ws.on("message", (message, isBinary) => {
    if (isBinary || message instanceof Buffer) {
      // Binary → Yjs CRDT update → forward to all clients
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
    // Text/JSON messages from clients can be handled here in the future
  });

  // 5. Handle disconnect
  ws.on("close", () => {
    console.log(`${userInfo.name} disconnected (${userInfo.userId})`);
    clients.delete(ws);
    broadcastPresence();
  });
});

console.log("WebSocket gateway running on ws://localhost:8080");
