require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const { Room, Route } = require("./models");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Connect to MongoDB
const mongoOptions = {
    serverSelectionTimeoutMS: 5000, // Fail fast if can't connect
    socketTimeoutMS: 45000,
};

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/trax";
const maskedUri = mongoUri.replace(/\/\/(.*):(.*)@/, "//***:***@");
console.log(`Attempting to connect to MongoDB: ${maskedUri}`);

mongoose.connect(mongoUri, mongoOptions)
    .then(() => {
        console.log("✅ Successfully connected to MongoDB");
        loadActiveRoutes();
    })
    .catch(err => {
        console.error("❌ MongoDB connection error:", err.message);
        console.error("TIP: Check your MONGODB_URI and IP Whitelist in Atlas.");
    });

// Connection event listeners
mongoose.connection.on('error', err => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.warn('Mongoose disconnected. Group data will not be persisted.');
});

// Serve client folder
app.use(express.static(path.join(__dirname, "../client")));

let users = {};
let userLocations = {}; // Track last known location of each user
let roomRoutes = {}; // Track the current route for each room
let roomLeaders = {}; // Track the leader (socket.id) of each room

// Load routes on startup
async function loadActiveRoutes() {
    try {
        const routes = await Route.find();
        routes.forEach(r => {
            roomRoutes[r.roomId] = {
                destination: r.destination,
                coordinates: r.coordinates
            };
            console.log(`Recovered route for room: ${r.roomId}`);
        });
    } catch (err) {
        console.error("Recovery error:", err);
    }
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Send MongoDB connection status
    socket.emit("mongodb_status", {
        connected: mongoose.connection.readyState === 1,
        status: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
    });

    // Join Room
    socket.on("join_room", async (data) => {
        const { username, room } = data;

        // Handle DB disconnected state early
        if (mongoose.connection.readyState !== 1) {
            console.warn(`Join room failed for ${username}: Database not connected.`);
            socket.emit("error_message", "Database is not connected. Group tracking might not work correctly.");
            // Continue with in-memory logic anyway so they can at least use the app
        }

        socket.join(room);

        users[socket.id] = {
            username,
            room
        };

        // Persistent Room Logic
        try {
            let roomDoc = await Room.findOne({ roomId: room });
            if (!roomDoc) {
                roomDoc = await Room.create({ roomId: room, leaderId: socket.id });
                console.log(`Room ${room} created in DB`);
            }

            // Assign leader in memory
            const currentLeaderId = roomLeaders[room];
            const isLeaderStillConnected = currentLeaderId && io.sockets.sockets.has(currentLeaderId);

            if (!roomLeaders[room] || !isLeaderStillConnected) {
                roomLeaders[room] = socket.id;
                console.log(`Leader assigned for room ${room}: ${username}`);
                // Sync to DB
                await Room.findOneAndUpdate({ roomId: room }, { leaderId: socket.id }, { upsert: true });
            }

            // Broadcast current leader
            const leaderId = roomLeaders[room];
            const leaderName = users[leaderId] ? users[leaderId].username : "Unknown";
            io.in(room).emit("leader_update", { leaderId, leaderName });

            console.log(`${username} joined room ${room}`);

            // Send existing users' locations (In-memory only)
            Object.entries(users)
                .filter(([userId, user]) => user.room === room && userId !== socket.id)
                .forEach(([userId, user]) => {
                    if (userLocations[userId]) {
                        socket.emit("receive_location", {
                            id: userId,
                            username: user.username,
                            lat: userLocations[userId].lat,
                            lng: userLocations[userId].lng,
                            heading: userLocations[userId].heading
                        });
                    }
                });

            // Send existing route (Check memory first, then DB)
            if (roomRoutes[room]) {
                socket.emit("route_received", roomRoutes[room]);
            } else {
                const routeDoc = await Route.findOne({ roomId: room });
                if (routeDoc) {
                    const routeData = {
                        destination: routeDoc.destination,
                        coordinates: routeDoc.coordinates
                    };
                    roomRoutes[room] = routeData;
                    socket.emit("route_received", routeData);
                }
            }
        } catch (err) {
            console.error("join_room DB error:", err);
        }
    });

    // Receive Location
    socket.on("send_location", (data) => {
        const user = users[socket.id];
        if (!user) return;

        userLocations[socket.id] = {
            lat: data.lat,
            lng: data.lng,
            heading: data.heading
        };

        const locationData = {
            id: socket.id,
            username: user.username,
            lat: data.lat,
            lng: data.lng,
            heading: data.heading
        };

        socket.to(user.room).emit("receive_location", locationData);
    });

    // Set Route
    socket.on("set_route", async (data) => {
        const user = users[socket.id];
        if (!user) return;

        // Check if sender is leader
        if (roomLeaders[user.room] !== socket.id) {
            console.log(`Unauthorized route set attempt by ${user.username} in room ${user.room}`);
            return;
        }

        roomRoutes[user.room] = data;
        console.log(`Route set for room ${user.room} by ${user.username}`);

        // Persist to MongoDB
        try {
            await Route.findOneAndUpdate(
                { roomId: user.room },
                {
                    roomId: user.room,
                    destination: data.destination,
                    coordinates: data.coordinates,
                    createdBy: user.username,
                    createdAt: new Date()
                },
                { upsert: true }
            );
            console.log(`Route persisted for room ${user.room}`);
        } catch (err) {
            console.error("set_route DB error:", err);
        }

        io.in(user.room).emit("route_received", data);
    });

    // Disconnect
    socket.on("disconnect", async () => {
        const user = users[socket.id];
        if (user) {
            const room = user.room;
            socket.to(room).emit("user_left", socket.id);
            console.log(`${user.username} disconnected`);
            delete users[socket.id];
            delete userLocations[socket.id];

            // If leader leaves, assign new leader
            if (roomLeaders[room] === socket.id) {
                delete roomLeaders[room];

                // Find someone else in the room
                const remainingUsers = Object.entries(users).filter(([id, u]) => u.room === room);
                if (remainingUsers.length > 0) {
                    const [newLeaderId, newLeader] = remainingUsers[0];
                    roomLeaders[room] = newLeaderId;
                    console.log(`New leader assigned for room ${room}: ${newLeader.username}`);

                    // Sync to DB
                    await Room.findOneAndUpdate({ roomId: room }, { leaderId: newLeaderId });

                    // Broadcast new leader to everyone
                    io.in(room).emit("leader_update", { leaderId: newLeaderId, leaderName: newLeader.username });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
