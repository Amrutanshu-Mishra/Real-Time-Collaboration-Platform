# SyncOrbit — Real-Time Collaboration Platform

A highly scalable, ultra-low latency, real-time collaborative text editing platform inspired by Google Docs and Notion. Built from the ground up using Conflict-Free Replicated Data Types (CRDTs).

## Key Features

- **True Real-Time Sync**: Instantaneous text synchronization across multiple distributed clients leveraging Yjs CRDTs.
- **Collaborative Cursors & Presence**: See exactly where your team is typing in real-time with live remote cursors and active user avatars.
- **Horizontally Scalable Gateway**: A custom Node.js WebSocket gateway designed to scale seamlessly across multiple instances using Redis Pub/Sub.
- **Intelligent Persistence**: Background snapshotting to MongoDB with single-flight deduplication to prevent database race conditions on high-concurrency cold boots.
- **Performance Optimized**: Frontend awareness throttling (50ms trailing-edge) and backend debounced presence broadcasts ensure efficient network utilization even with 100+ active peers.

## Tech Stack

- **Frontend**: Next.js (React), Tiptap Editor, Tailwind CSS, Shadcn UI
- **Real-time Core**: Yjs (CRDTs), `y-protocols/awareness`
- **Gateway Server**: Node.js, `ws` (WebSockets)
- **Pub/Sub & Scaling**: Redis (`ioredis`)
- **Persistence**: MongoDB, Mongoose

## Architecture Deep Dive

The platform utilizes a carefully orchestrated 5-stage pipeline for CRDT updates:
1. Client generates delta
2. WebSocket ingest
3. Local Server Y.Doc sync
4. Redis cross-node distribution
5. Lazy MongoDB Snapshotting

For a detailed breakdown of the internal data flow, state guards, and scaling strategies, see the [System Design Document](system-design.md).

## Local Development Setup

### 1. Requirements
Ensure you have Node.js, a running MongoDB instance (default port 27017), and a running Redis instance (default port 6379).

### 2. Install Dependencies
```bash
# Gateway Server
cd services/ws-gateway
npm install

# Frontend
cd ../../apps/frontend
npm install
```

### 3. Start Development Servers
```bash
# Start the WebSockets Gateway (Port 8080)
cd services/ws-gateway
npm run dev

# Start the Frontend App (Port 3000)
cd ../../apps/frontend
npm run dev
```

Navigate to `http://localhost:3000`, enter a document name, and start collaborating in real-time.