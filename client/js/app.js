import { state } from './state.js';
import { setupSocketHandlers } from './socket-handlers.js';
import { initMap, togglePerspective, locateMe, centerRoute, setDestination, checkOffRoute, rotateMap } from './map-engine.js';
import { updateStatusBadge, updateRoomInfo, displaySearchResults, updateGroupStats, getDistance, toggleStats } from './ui-utils.js';
import { getCustomIcon } from './config.js';

const socket = io();
setupSocketHandlers(socket);

// Make functions available to HTML globals if needed, or better, bind events here
window.joinRoom = joinRoom;
window.togglePerspective = togglePerspective;
window.locateMe = locateMe;
window.centerRoute = centerRoute;
window.debounceSearch = debounceSearch;
window.toggleStats = toggleStats;

function startApp() {
    initMap();
    setTimeout(() => state.map.invalidateSize(), 500);

    // Map click
    state.map.on('click', function (e) {
        if (!state.username) return;
        if (!state.isLeader) {
            alert("Only the room leader can set a destination.");
            return;
        }
        setDestination(e.latlng.lat, e.latlng.lng, socket);
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp);
} else {
    startApp();
}

function joinRoom(isDemo = false) {
    state.username = document.getElementById("username").value || (isDemo ? "Demo User" : "");
    const code = document.getElementById("room").value || "";

    if (!state.username) {
        alert("Please enter your name");
        return;
    }

    socket.emit("join_room", { username: state.username, inviteCode: code });
    document.getElementById("join-form").classList.add("hidden");
    document.getElementById("search-panel").classList.remove("hidden");

    state.isDemoMode = isDemo;
    updateStatusBadge(`Room: ${state.room}`);
    updateRoomInfo(socket.id);

    if (isDemo) {
        simulateLocation();
    } else {
        startTracking();
    }
}

function simulateLocation() {
    let lat = 28.6139 + (Math.random() - 0.5) * 0.01;
    let lng = 77.2090 + (Math.random() - 0.5) * 0.01;
    let heading = 0;

    const update = () => {
        const dLat = (Math.random() - 0.5) * 0.001;
        const dLng = (Math.random() - 0.5) * 0.001;
        lat += dLat;
        lng += dLng;

        heading = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;

        const now = Date.now();
        if (state.myPrevPos && state.myLastTime) {
            const dt = (now - state.myLastTime) / 1000;
            if (dt > 0) {
                const d = getDistance(state.myPrevPos.lat, state.myPrevPos.lng, lat, lng);
                state.mySpeed = d / dt;
            }
        }
        state.myPrevPos = { lat, lng };
        state.myLastTime = now;

        if (state.myMarker) {
            state.myMarker.setLatLng([lat, lng]);
            state.myMarker.setIcon(getCustomIcon('#3b82f6', true, heading));
            state.myMarker.getPopup().setContent(`<b>You (Demo)</b><br>Speed: ${(state.mySpeed * 3.6).toFixed(1)} km/h`);
        } else {
            state.myMarker = L.marker([lat, lng], { icon: getCustomIcon('#3b82f6', true, heading) })
                .addTo(state.map)
                .bindPopup(`<b>You (Demo)</b><br>Speed: 0 km/h`);
            state.map.setView([lat, lng], 15);
        }

        if (state.isPerspectiveMode) {
            state.map.setView([lat, lng], 18, { animate: true });
            rotateMap(heading);
        }

        socket.emit("send_location", { lat, lng, heading });
        updateStatusBadge();
        checkOffRoute(lat, lng);
        updateGroupStats();
        updateRoomInfo(socket.id);
    };

    update();
    state.trackingInterval = setInterval(update, 3000);
}

function startTracking() {
    if (state.trackingInterval) return;

    updateStatusBadge("Locating...");

    state.trackingInterval = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude: lat, longitude: lng, heading } = position.coords;
            state.myHeading = heading || 0;

            const now = Date.now();
            if (state.myPrevPos && state.myLastTime) {
                const dt = (now - state.myLastTime) / 1000;
                if (dt > 0) {
                    const d = getDistance(state.myPrevPos.lat, state.myPrevPos.lng, lat, lng);
                    state.mySpeed = d / dt;
                }
            }
            state.myPrevPos = { lat, lng };
            state.myLastTime = now;

            if (state.myMarker) {
                state.myMarker.setLatLng([lat, lng]);
                state.myMarker.setIcon(getCustomIcon('#3b82f6', true, state.myHeading));
                state.myMarker.getPopup().setContent(`<b>You</b><br>Speed: ${(state.mySpeed * 3.6).toFixed(1)} km/h`);
            } else {
                state.myMarker = L.marker([lat, lng], { icon: getCustomIcon('#3b82f6', true, state.myHeading) })
                    .addTo(state.map)
                    .bindPopup(`<b>You</b><br>Speed: 0 km/h`);

                if (!state.routeLine) state.map.setView([lat, lng], 15);
                if (state.currentStatus === "Locating...") {
                    updateStatusBadge(`Room: ${state.room}`);
                }
            }

            if (state.isPerspectiveMode) {
                state.map.setView([lat, lng], 18, { animate: true });
                rotateMap(state.myHeading);
            }

            socket.emit("send_location", { lat, lng, heading: state.myHeading });
            checkOffRoute(lat, lng);
            updateGroupStats();
            updateRoomInfo(socket.id);
        },
        (error) => {
            console.error("Location error:", error);
            let msg = "Location error";
            if (error.code === 1) msg = "GPS Denied";
            else if (error.code === 2) msg = "GPS Unavailable";
            else if (error.code === 3) msg = "GPS Timeout";
            updateStatusBadge(msg);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

let searchTimeout = null;
function debounceSearch(query) {
    clearTimeout(searchTimeout);
    if (!query.trim()) {
        document.getElementById("search-results").classList.add("hidden");
        return;
    }
    searchTimeout = setTimeout(() => performSearch(query), 500);
}

async function performSearch(query) {
    if (!state.isLeader) return;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        displaySearchResults(data, (lat, lon, name) => {
            setDestination(lat, lon, socket);
            document.getElementById("destination-search").value = name;
        });
    } catch (err) {
        console.error("Search error:", err);
    }
}
