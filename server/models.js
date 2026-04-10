const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    inviteCode: { type: String, required: true, unique: true },
    leaderId: { type: String, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Auto-delete after 24 hours of inactivity
RoomSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

const RouteSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    destination: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    coordinates: [[Number]], // Array of [lat, lng]
    createdBy: { type: String, required: true }
}, { timestamps: true });

// Auto-delete after 24 hours of inactivity
RouteSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

const Room = mongoose.model('Room', RoomSchema);
const Route = mongoose.model('Route', RouteSchema);

module.exports = { Room, Route };
