import * as Y from "yjs";
import { loadSnapshot } from "./db/snapshotStore.js";
import { forceSnapshot } from "./snapshotSystem.js";

// ── Logging helper (mirrors server.js) ─────────────────────────────────────
function log(tag, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  console.log(`[${timestamp}] [${tag}]  ${message}${metaStr}`);
}

// ── Room store ──────────────────────────────────────────────────────────────
//
// rooms        → fully initialised rooms that are ready to use
// loadingDocs  → in-flight load promises (the dedup guard)
//
// Lifecycle per docId:
//   (not present)
//       │  first caller creates a Promise and stores it in loadingDocs
//       ▼
//   loadingDocs[docId] = Promise<Room>
//       │  concurrent callers await this same promise
//       ▼
//   rooms[docId] = Room   (promise removed from loadingDocs)
//       │  GC evicts when idle
//       ▼
//   (not present again — next caller starts fresh)
//
export const rooms = new Map(); // Map<docId, Room>
const loadingDocs = new Map(); // Map<docId, Promise<Room>>

/**
 * Lazy-load a document room with single-flight deduplication.
 *
 * Guarantees:
 *  • At most ONE MongoDB read per docId per server instance.
 *  • Concurrent callers for the same (not-yet-loaded) docId all
 *    receive the same Room once the single load completes.
 *  • Redis updates that arrive before a room is loaded will trigger
 *    a load and then apply cleanly (no update is lost).
 *
 * @param {string} docId
 * @param {(docId: string) => void} onFirstLoad
 *   Callback invoked (once) immediately after a new room is created.
 *   Use this to subscribe the doc to a Redis channel.
 * @returns {Promise<Room>}
 */
export async function getOrCreateRoom(docId, onFirstLoad) {
  // ── Fast path: room already fully loaded ───────────────────────────────
  if (rooms.has(docId)) {
    return rooms.get(docId);
  }

  // ── Dedup path: a load is already in flight — join it ─────────────────
  if (loadingDocs.has(docId)) {
    log("ROOM", "Waiting for in-flight load (dedup)", { docId });
    return loadingDocs.get(docId);
  }

  // ── First caller: create the load promise and register it ─────────────
  const loadPromise = _loadRoom(docId, onFirstLoad);
  loadingDocs.set(docId, loadPromise);

  try {
    const room = await loadPromise;
    return room;
  } finally {
    // Always clean up the in-flight entry, whether success or error.
    loadingDocs.delete(docId);
  }
}

/**
 * Internal: actually load the document state from MongoDB,
 * build the Room object, and register it.
 *
 * @private
 */
async function _loadRoom(docId, onFirstLoad) {
  const doc = new Y.Doc();
  let snapshotLoaded = false;
  let snapshotBytes = 0;

  // Load persisted snapshot from MongoDB
  const snapshotData = await loadSnapshot(docId);
  if (snapshotData && snapshotData.length > 0) {
    try {
      Y.applyUpdate(doc, snapshotData);
      snapshotLoaded = true;
      snapshotBytes = snapshotData.length;
    } catch (err) {
      log("ROOM", "Failed to apply snapshot — starting with empty doc", {
        docId,
        error: err.message,
      });
    }
  }

  const now = Date.now();
  const room = {
    doc,
    clients: new Map(),
    updateCount: 0,
    lastSnapshotAt: snapshotLoaded ? now : 0,
    lastActivityAt: now,
    updateLog: [],
  };

  rooms.set(docId, room);

  log(
    "ROOM",
    snapshotLoaded
      ? "Created room — loaded snapshot from DB"
      : "Created room — no existing snapshot (new doc)",
    {
      docId,
      ...(snapshotLoaded && { bytes: snapshotBytes }),
      totalRooms: rooms.size,
    }
  );

  // Notify caller so it can subscribe to Redis, set up timers, etc.
  if (typeof onFirstLoad === "function") {
    onFirstLoad(docId);
  }

  return room;
}

/**
 * Evict an idle room from memory.
 *
 * Persists a final snapshot before eviction so no data is lost.
 * Cleans both `rooms` and the (unlikely but possible) `loadingDocs` entry.
 *
 * @param {string} docId
 */
export function evictRoom(docId) {
  const room = rooms.get(docId);
  if (room) {
    forceSnapshot(room, docId);
    rooms.delete(docId);
    log("GC", "Snapshot saved & idle room evicted from memory", {
      docId,
      totalRooms: rooms.size,
    });
  }
  // Safety: remove any stale in-flight entry (should never happen, but be safe)
  loadingDocs.delete(docId);
}
