# Trax Developer Guide 🚀

Welcome to the **Trax** developer documentation. Trax is a real-time group tracking application designed for mobile-first experiences. It allows users to join rooms, share their live locations, set shared destinations, and monitor route adherence.

---

## 🛠 Tech Stack

- **Backend**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/)
- **Real-time Communication**: [Socket.io](https://socket.io/)
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript
- **Maps**: [Leaflet.js](https://leafletjs.com/) with [OpenStreetMap](https://www.openstreetmap.org/) tiles
- **Routing**: [OSRM (Open Source Routing Machine) API](http://project-osrm.org/)

---

## 📂 Project Structure

```text
trax/
├── client/
│   └── index.html      # Single-page frontend (HTML/CSS/JS)
├── server/
│   └── server.js      # Express server & Socket.io logic
├── package.json        # Dependencies and scripts
└── DEVELOPER_GUIDE.md  # This document
```

---

## ⚙️ How It Works

### 1. Connection & Room Management
The app uses **Socket.io rooms** to isolate group tracking.
- When a user joins, they are added to a specific room based on the "Room Code".
- **Robust Leader System**:
    - The first person to join a room is assigned as the **Leader**.
    - **Active Verification**: Before assigning or reclaiming leadership, the server verifies if the current leader's socket is actually connected in the room. This prevents "zombie" sessions from blocking leadership.
    - **Dynamic Promotion**: If the leader leaves, the server promotes the next available member and notifies the room via the `leader_update` event.
    - **DB Sync**: Leadership status is synchronized with the MongoDB `Room` model in real-time.
- **Database Connectivity**:
    - **Fast-Fail Connection**: MongoDB connection is configured with a `serverSelectionTimeoutMS` of 5000ms. If the DB is unreachable, the server fails fast instead of hanging.
    - **Buffer-Free Operations**: Mongoose command buffering is managed to prevent operations from queueing indefinitely when the database is down.
    - **Status Monitoring**: On every connection, the server emits a `mongodb_status` event to the client to confirm database readiness.

### 2. Real-time Persistence
- **In-memory**: Active user lists and live location updates are strictly in-memory for zero-latency broadcasting.
- **MongoDB**: 
    - **Rooms**: Persistent leadership and room metadata.
    - **Routes**: Active and previous destinations are saved to ensure sessions survive server restarts (auto-reloaded on startup via `loadActiveRoutes`).

### 3. UI/UX & Map Dynamics
- **Mobile-First UX**: Recent updates have optimized the layout for mobile viewports, including:
    - **Glassmorphism Refinement**: Reduced blur (`blur(2px)`) for better performance and readability.
    - **Interface Positioning**: Relocated floating action buttons and zoom controls to avoid interference with system navigation bars.
- **Route Adherence**: Calculates distance to the track. If >50m, user is "OFF ROUTE". If >100m, an **Auto Re-route** (dashed path) is generated privately for that user.
- **Group Metrics**: Displays real-time distances to the Leader and calculates whole-group spread.

---

## 📡 Socket.io Events

| Event | Direction | Data Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_room` | Client -> Server | `{ username, room }` | Joins a room and initializes session. |
| `leader_update` | Server -> Client | `{ leaderId, leaderName }` | Notifies the room of the current leader's identity. |
| `mongodb_status`| Server -> Client | `{ connected, status }` | Reports the current DB connection state. |
| `error_message` | Server -> Client | `string` | General error channel for alerts. |
| `send_location` | Client -> Server | `{ lat, lng, heading }` | Sends current GPS coordinates and bearing. |
| `receive_location`| Server -> Client | `{ id, username, lat, lng, heading }` | Updates other users' pins and orientation. |
| `set_route` | Client -> Server | `{ destination, coordinates }` | Sets shared destination (Leader Only). |
| `user_left` | Server -> Client | `socketId` | Removes a user's marker on disconnect. |

---

## 🚀 Troubleshooting & Deployment (Render)

### 1. MongoDB Connection Issue (`Buffering Timeout`)
If the logs show "MongooseError: Operation ... buffering timed out after 10000ms":
- **IP Whitelist**: Ensure your MongoDB Atlas is set to allow access from anywhere (`0.0.0.0/0`) during deployment, as Render IPs change.
- **Environment Variables**: Verify `MONGODB_URI` is correctly populated in the Render Dashboard -> Environment section.

### 2. Leadership Status Missing
- Check if multiple instances are running. Trax uses in-memory leadership; ensure Render is set to **1 instance** unless a Redis adapter is added for Socket.io.

---

## 🛠 Development Commands

- **Install Dependencies**: `npm install`
- **Run Server**: `npm start`
- **Access App**: Navigate to `http://localhost:3000`

---

*Knowledge Transfer Complete. Happy Coding!* 🛰️
