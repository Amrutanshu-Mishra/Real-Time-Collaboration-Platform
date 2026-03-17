import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  docId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  snapshot: {
    type: Buffer,
    required: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

const Document = mongoose.model("Document", documentSchema);

export default Document;
