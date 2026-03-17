import mongoose from "mongoose";

const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/collab-platform";

/**
 * Connect to MongoDB.
 * Resolves when the connection is established; rejects on failure.
 */
export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[DB] Connected to MongoDB at ${MONGO_URI}`);
  } catch (err) {
    console.error(`[DB] MongoDB connection failed: ${err.message}`);
    throw err;
  }
}
