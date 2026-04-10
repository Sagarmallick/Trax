const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    inviteCode: { type: String, required: true, unique: true },
    leaderId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true }
});

const RouteSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    destination: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    coordinates: [[Number]], // Array of [lat, lng]
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', RoomSchema);
const Route = mongoose.model('Route', RouteSchema);

module.exports = { Room, Route };
