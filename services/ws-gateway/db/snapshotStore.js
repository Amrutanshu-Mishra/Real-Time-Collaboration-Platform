import Document from "./models/Document.js";

/**
 * Load a document snapshot from MongoDB.
 * @param {string} docId
 * @returns {Promise<Buffer|null>} The snapshot buffer, or null if not found.
 */
export async function loadSnapshot(docId) {
  try {
    const doc = await Document.findOne({ docId });
    if (doc && doc.snapshot) {
      console.log(`[SNAPSHOT] Loaded from DB`, { docId, bytes: doc.snapshot.length });
      return doc.snapshot;
    }
  } catch (err) {
    console.error(`[SNAPSHOT] Load error`, { docId, error: err.message });
  }
  return null;
}

/**
 * Save (upsert) a document snapshot to MongoDB.
 * @param {string} docId
 * @param {Buffer} data — the Yjs encoded state
 */
export async function saveSnapshot(docId, data) {
  try {
    await Document.findOneAndUpdate(
      { docId },
      { snapshot: data, lastUpdated: new Date() },
      { upsert: true, new: true }
    );
    console.log(`[SNAPSHOT] Saved to DB`, { docId, bytes: data.length });
  } catch (err) {
    console.error(`[SNAPSHOT] Save error`, { docId, error: err.message });
  }
}
