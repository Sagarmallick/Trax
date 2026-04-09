const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve client folder
app.use(express.static(path.join(__dirname, "../client")));

let users = {};
let userLocations = {}; // Track last known location of each user
let roomRoutes = {}; // Track the current route for each room
let roomLeaders = {}; // Track the leader (socket.id) of each room

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Join Room
    socket.on("join_room", (data) => {
        const { username, room } = data;

        socket.join(room);

        users[socket.id] = {
            username,
            room
        };

        // Assign leader if room is new
        if (!roomLeaders[room]) {
            roomLeaders[room] = socket.id;
            console.log(`Leader assigned for room ${room}: ${username}`);
        }

        // Broadcast current leader to everyone in room
        const leaderId = roomLeaders[room];
        const leaderName = users[leaderId] ? users[leaderId].username : "Unknown";
        io.in(room).emit("leader_update", { leaderId, leaderName });

        console.log(`${username} joined room ${room}`);

        // Send existing users' locations to newly joined user
        Object.entries(users)
            .filter(([userId, user]) => user.room === room && userId !== socket.id)
            .forEach(([userId, user]) => {
                if (userLocations[userId]) {
                    const locationData = {
                        id: userId,
                        username: user.username,
                        lat: userLocations[userId].lat,
                        lng: userLocations[userId].lng,
                        heading: userLocations[userId].heading
                    };
                    socket.emit("receive_location", locationData);
                }
            });

        // Send existing route to joining user
        if (roomRoutes[room]) {
            socket.emit("route_received", roomRoutes[room]);
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
    socket.on("set_route", (data) => {
        const user = users[socket.id];
        if (!user) return;

        // Check if sender is leader
        if (roomLeaders[user.room] !== socket.id) {
            console.log(`Unauthorized route set attempt by ${user.username} in room ${user.room}`);
            return;
        }

        roomRoutes[user.room] = data; // data contains destination and coordinates
        console.log(`Route set for room ${user.room} by ${user.username}`);

        // Broadcast to everyone in room including sender (or just others?)
        // Usually sender already has it, but broadcasting to everyone ensures consistency
        io.in(user.room).emit("route_received", data);
    });

    // Disconnect
    socket.on("disconnect", () => {
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
