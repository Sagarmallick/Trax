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
- **Leader System**: The first person to join a room is assigned as the **Leader**. The server broadcasts `leader_update` to all participants, ensuring everyone knows who the current leader is.
- **Dynamic Promotion**: If the leader leaves, the server automatically promotes the next available member to Leader status and notifies the room.
- The server maintains state for active `users`, their `userLocations`, and any active `roomRoutes`.

### 2. Location Tracking & Navigation
- **Real-time**: High-accuracy tracking using `navigator.geolocation.watchPosition`, now including **heading/bearing** data and **speed** calculation.
- **Compass Integration**: Uses the `deviceorientation` API for precise orientation.
- **Perspective Mode**: Rotates the map so the user's heading points "up".
- **Auto Re-route**: If a user is significantly off-route, the app automatically generates a private "guide back" route (dashed line) to the destination.
- **Group Metrics**: Calculates real-time distances to the Leader and the "Last Rider" (furthest from destination).
- **Spread Visualization**: Draws a bounding box around all group members to show spatial spread.
- **Speed Alerts**: Detects and flags users who are "TOO FAST" or "LAGGING" relative to the group average.

### 3. Shared Routing & Search
- **Manual Selection**: Leaders can click on the map to set a destination.
- **Top Search Bar**: A search bar is integrated into the header (Leader only), powered by the **Nominatim API**.
- The client fetches the optimal driving path from the **OSRM API**.
- This route is broadcast to all users in the room via the `set_route` event.
- New joiners automatically receive the active route upon joining.

### 4. Route Adherence (Off-Route Detection)
- The app calculates the distance between the user's current location and the nearest point on the active polyline route.
- If the distance exceeds **50 meters**, the UI displays an "OFF ROUTE" alert with a pulse animation.

---

## 📡 Socket.io Events

| Event | Direction | Data Payload | Description |
| :--- | :--- | :--- | :--- |
| `join_room` | Client -> Server | `{ username, room }` | Joins a room and initializes session. |
| `leader_update` | Server -> Client | `{ leaderId, leaderName }` | Notifies the room of the current leader's identity. |
| `send_location` | Client -> Server | `{ lat, lng }` | Sends current GPS coordinates. |
| `receive_location` | Server -> Client | `{ id, username, lat, lng }` | Updates other users' pins on the map. |
| `set_route` | Client -> Server | `{ destination, coordinates }` | Sets a new shared destination and path (Leader Only). |
| `route_received` | Server -> Client | `{ destination, coordinates }` | Renders the path polyline for all users. |
| `user_left` | Server -> Client | `socketId` | Removes a user's marker when they disconnect. |

---

## 🚀 Step-by-Step Implementation Guide

### Phase 1: Server Setup
1. Initialize Express and HTTP server.
2. Integrate Socket.io.
3. Set up static file serving for the `/client` directory.

### Phase 2: Client Interface
1. Load Leaflet.css and Socket.io client.
2. Create a full-screen `#map` container.
3. Design the glassmorphism UI for Join Panel and Status Badge.

### Phase 3: Real-time Logic
1. Implement `joinRoom()` to emit socket events and hide the overlay.
2. Set up `watchPosition` to feed data to `send_location`.
3. Listen for `receive_location` to create or update Leaflet markers for other participants.

### Phase 4: Routing & Refinement
1. Add map click listeners to trigger OSRM API calls.
2. Implement `L.polyline` rendering for shared routes.
3. Add the distance calculation logic for off-route alerts.

---

## 🛠 Development Commands

- **Install Dependencies**: `npm install`
- **Run Server**: `npm start`
- **Access App**: Navigate to `http://localhost:3000`

---

*Happy Coding!* 🛰️
