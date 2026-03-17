import * as Y from "yjs";
import { saveSnapshot } from "./db/snapshotStore.js";

const SNAPSHOT_UPDATE_INTERVAL = 50; // snapshot every N updates
const SNAPSHOT_MAX_AGE_MS = Number(
  process.env.SNAPSHOT_MAX_AGE_MS || 5 * 60 * 1000
); // or every N minutes

/**
 * Track a document update and decide whether to persist a snapshot.
 *
 * This is the final stage of the pipeline:
 *   client → WS → Y.Doc → Redis Pub/Sub → **Snapshot System** → MongoDB
 *
 * Called after every CRDT update has been applied to the server Y.Doc
 * and distributed via Redis. When thresholds are reached, encodes the
 * current Y.Doc state and persists it to MongoDB.
 *
 * @param {object} room  — the room object (doc, updateLog, updateCount, …)
 * @param {string} docId — the document identifier
 */
export function trackUpdate(room, docId) {
  const now = Date.now();
  room.updateCount = (room.updateCount || 0) + 1;
  room.lastActivityAt = now;

  const lastSnapshotAt = room.lastSnapshotAt || 0;
  const shouldByCount = room.updateCount >= SNAPSHOT_UPDATE_INTERVAL;
  const shouldByTime =
    SNAPSHOT_MAX_AGE_MS > 0 && now - lastSnapshotAt >= SNAPSHOT_MAX_AGE_MS;

  if (shouldByCount || shouldByTime) {
    room.updateCount = 0;
    room.lastSnapshotAt = now;

    const state = Y.encodeStateAsUpdate(room.doc);
    saveSnapshot(docId, Buffer.from(state)); // async, fire-and-forget

    room.updateLog = []; // clear in-memory update log after snapshot
  }
}

/**
 * Force-save a snapshot immediately (used when a room empties or is GC'd).
 *
 * @param {object} room  — the room object
 * @param {string} docId — the document identifier
 */
export function forceSnapshot(room, docId) {
  const state = Y.encodeStateAsUpdate(room.doc);
  saveSnapshot(docId, Buffer.from(state)); // async, fire-and-forget
  room.updateLog = [];
  room.lastSnapshotAt = Date.now();
}
