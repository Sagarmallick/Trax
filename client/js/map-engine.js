import { state } from './state.js';
import { CONFIG, getCustomIcon, destIcon } from './config.js';
import { getDistance, updateStatusBadge } from './ui-utils.js';

export function initMap() {
    state.map = L.map('map', { zoomControl: false }).setView(CONFIG.DEFAULT_VIEW, CONFIG.DEFAULT_ZOOM);
    L.control.zoom({ position: 'topright' }).addTo(state.map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(state.map);

    return state.map;
}

export function rotateMap(heading) {
    const mapEl = document.getElementById('map');
    if (state.isPerspectiveMode && heading !== 0) {
        mapEl.style.transform = `rotate(${-heading}deg) scale(1.6)`;
    } else {
        mapEl.style.transform = `rotate(0deg) scale(1)`;
    }
}

export function togglePerspective() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    startCompass();
                }
            })
            .catch(console.error);
    } else {
        startCompass();
    }

    state.isPerspectiveMode = !state.isPerspectiveMode;
    document.getElementById("perspective-btn").classList.toggle("fab-active", state.isPerspectiveMode);

    if (!state.isPerspectiveMode) {
        rotateMap(0);
    }

    if (state.isPerspectiveMode && state.myMarker) {
        const latlng = state.myMarker.getLatLng();
        state.map.setView(latlng, CONFIG.PERSPECTIVE_ZOOM, { animate: true });
        if (state.myCompassHeading) rotateMap(state.myCompassHeading);
    }
}

export function startCompass() {
    if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', handleOrientation, true);
    }
}

function handleOrientation(event) {
    let heading = 0;
    if (event.webkitCompassHeading) {
        heading = event.webkitCompassHeading;
    } else if (event.absolute) {
        heading = 360 - event.alpha;
    } else {
        return;
    }

    state.myCompassHeading = heading;
    if (state.myMarker) {
        state.myMarker.setIcon(getCustomIcon('#3b82f6', true, state.myCompassHeading));
        if (state.isPerspectiveMode) {
            rotateMap(state.myCompassHeading);
        }
    }
}

export function locateMe() {
    if (state.myMarker) {
        state.map.setView(state.myMarker.getLatLng(), state.isPerspectiveMode ? CONFIG.PERSPECTIVE_ZOOM : 15, { animate: true });
    }
}

export function centerRoute() {
    if (state.routeLine) {
        state.map.fitBounds(state.routeLine.getBounds(), { padding: [50, 50] });
    }
}

export async function setDestination(lat, lng, socket) {
    if (!state.myMarker) {
        alert("Waiting for your location...");
        return;
    }

    const myPos = state.myMarker.getLatLng();
    const url = `https://router.project-osrm.org/route/v1/driving/${myPos.lng},${myPos.lat};${lng},${lat}?overview=full&geometries=geojson`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            socket.emit("set_route", {
                destination: { lat, lng },
                coordinates: coords
            });
        }
    } catch (error) {
        console.error("Error fetching route:", error);
    }
}

export function checkOffRoute(lat, lng) {
    if (!state.currentRouteCoords.length) return;

    let minDistance = Infinity;
    for (const pt of state.currentRouteCoords) {
        const d = getDistance(lat, lng, pt[0], pt[1]);
        if (d < minDistance) minDistance = d;
    }

    if (minDistance > 50) {
        updateStatusBadge(`OFF ROUTE (${Math.round(minDistance)}m)`);
        if (minDistance > 100) autoReRoute(lat, lng);
    } else {
        updateStatusBadge("On Route");
        if (state.rerouteLine) {
            state.map.removeLayer(state.rerouteLine);
            state.rerouteLine = null;
        }
    }
}

async function autoReRoute(lat, lng) {
    if (!state.destinationMarker || state.rerouteLine) return;

    const dest = state.destinationMarker.getLatLng();
    const url = `https://router.project-osrm.org/route/v1/driving/${lng},${lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
            if (state.rerouteLine) state.map.removeLayer(state.rerouteLine);
            state.rerouteLine = L.polyline(coords, {
                color: '#f43f5e',
                weight: 4,
                opacity: 0.6,
                dashArray: '10, 10'
            }).addTo(state.map);
        }
    } catch (err) {
        console.error("Auto-reroute error:", err);
    }
}
