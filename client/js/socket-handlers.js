import { state } from './state.js';
import { updateStatusBadge, updateRoomInfo, getDistance, updateGroupStats } from './ui-utils.js';
import { destIcon, getCustomIcon } from './config.js';

export function setupSocketHandlers(socket) {
    socket.on("connect", () => {
        console.log("✅ Socket connected to server. ID:", socket.id);
    });

    socket.on("mongodb_status", (data) => {
        console.log(`🔌 MongoDB Status: ${data.status}`);
        if (data.connected) {
            console.log("✅ Database is ready.");
        } else {
            console.warn("❌ Database is NOT connected. Check MONGODB_URI.");
        }
    });

    socket.on("route_received", (data) => {
        const { destination, coordinates, distance, duration } = data;
        state.currentRouteCoords = coordinates;
        state.currentRouteDistance = distance || 0;
        state.currentRouteDuration = duration || 0;
        document.getElementById('route-toggle').classList.remove('hidden');

        if (state.destinationMarker) {
            state.destinationMarker.setLatLng([destination.lat, destination.lng]);
        } else {
            state.destinationMarker = L.marker([destination.lat, destination.lng], { icon: destIcon })
                .addTo(state.map).bindPopup("<b>Destination</b>");
        }

        if (state.routeLine) {
            state.routeLine.setLatLngs(coordinates);
        } else {
            state.routeLine = L.polyline(coordinates, {
                color: '#3b82f6',
                weight: 6,
                opacity: 0.7,
                lineJoin: 'round'
            }).addTo(state.map);
        }
        state.map.fitBounds(state.routeLine.getBounds(), { padding: [50, 50] });

        // Refresh UI with metrics if we already have our location
        updateRoomInfo(socket.id);
    });

    socket.on("receive_location", (data) => {
        let { id, username: otherName, lat, lng, heading } = data;
        if (id === socket.id) return;

        const now = Date.now();
        let speed = 0;

        if (state.otherUsers[id]) {
            const prev = state.otherUsers[id].marker.getLatLng();
            const dt = (now - state.otherUsers[id].lastTime) / 1000; // seconds
            if (dt > 0) {
                const dist = getDistance(prev.lat, prev.lng, lat, lng);
                speed = dist / dt; // m/s
            }

            state.otherUsers[id].marker.setLatLng([lat, lng]);
            state.otherUsers[id].marker.setIcon(getCustomIcon(state.otherUsers[id].color, false, heading));
            state.otherUsers[id].lastTime = now;
            state.otherUsers[id].speed = speed;
        } else {
            const colors = ['#e11d48', '#10b981', '#6366f1', '#f59e0b', '#8b5cf6'];
            const color = colors[Object.keys(state.otherUsers).length % colors.length];
            const marker = L.marker([lat, lng], {
                icon: getCustomIcon(color, false, heading)
            }).addTo(state.map);

            state.otherUsers[id] = {
                marker: marker,
                username: otherName,
                color: color,
                lastTime: now,
                speed: 0
            };
        }

        // Update popup with distance and speed
        let popupContent = `<b>${otherName}</b><br>Speed: ${(state.otherUsers[id].speed * 3.6).toFixed(1)} km/h`;
        if (state.destinationMarker) {
            const dist = getDistance(lat, lng, state.destinationMarker.getLatLng().lat, state.destinationMarker.getLatLng().lng);
            popupContent += `<br>${(dist / 1000).toFixed(1)}km to dest`;
        }
        state.otherUsers[id].marker.bindPopup(popupContent);

        updateGroupStats();
    });

    socket.on("leader_update", (data) => {
        console.log("Leader Update Received:", data);
        state.roomLeaderId = data.leaderId;
        state.roomLeaderName = data.leaderName;
        state.inviteCode = data.inviteCode;
        state.room = data.room || state.room;
        state.isLeader = (state.roomLeaderId === socket.id);

        updateStatusBadge();
        updateRoomInfo(socket.id);

        // Disable/Hide search for non-leaders
        const searchInput = document.getElementById("destination-search");
        const searchPanel = document.getElementById("search-panel");
        if (state.isLeader) {
            searchInput.disabled = false;
            searchInput.placeholder = "Search for a place";
            searchPanel.classList.remove("hidden");
        } else {
            searchInput.disabled = true;
            searchInput.placeholder = "Only Leader can set destination";
            searchPanel.classList.add("hidden");
            document.getElementById("search-results").classList.add("hidden");
        }

        console.log("Leader update:", data);
    });

    socket.on("error_message", (msg) => {
        alert(msg);
    });

    socket.on("user_left", (id) => {
        if (state.otherUsers[id]) {
            state.map.removeLayer(state.otherUsers[id].marker);
            delete state.otherUsers[id];
        }
    });
}
