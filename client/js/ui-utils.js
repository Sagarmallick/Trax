import { state } from './state.js';

export function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export function getRemainingDistance(lat, lng, coords) {
    if (!coords || coords.length < 2) return 0;

    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < coords.length; i++) {
        const d = getDistance(lat, lng, coords[i][0], coords[i][1]);
        if (d < minDistance) {
            minDistance = d;
            closestIndex = i;
        }
    }

    let total = minDistance;
    for (let i = closestIndex; i < coords.length - 1; i++) {
        total += getDistance(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
    }

    return total;
}

export function updateStatusBadge(message = null) {
    if (message) state.currentStatus = message;
    const statusEl = document.getElementById("status-display");

    let badgeText = state.currentStatus;
    let badgeClass = "status-badge";

    if (state.currentStatus.includes("OFF ROUTE") || state.currentStatus.includes("error") || state.currentStatus.includes("Denied")) {
        badgeClass += " status-off-route";
    } else if (state.currentStatus === "On Route") {
        badgeClass += " status-on-route";
    }

    if (state.isLeader) {
        badgeClass += " status-leader";
        badgeText += " (Leader)";
    } else if (state.roomLeaderName) {
        badgeText += ` (Ldr: ${state.roomLeaderName})`;
    }

    // Append distance if routing (Keeping top badge for status, but metrics moved to bottom for visibility)
    if (state.myMarker && state.destinationMarker && state.currentRouteCoords.length > 0) {
        // We'll keep the text clean here just for 'On Route'/'OFF ROUTE'
    }

    statusEl.innerText = badgeText;
    statusEl.className = badgeClass;
}

export function updateRoomInfo(socketId) {
    const infoEl = document.getElementById("room-info");
    const summaryEl = document.getElementById("dashboard-summary-text");

    if (!state.room && !state.inviteCode) {
        if (infoEl) infoEl.innerText = "Join a room to start tracking.";
        return;
    }

    let text = `<div style="background: rgba(255,255,255,0.1); padding: 2px; border-radius: 12px; margin-bottom: 0px; border: 1px solid rgba(255,255,255,0.2);">
        <div style="color: green; font-size: 1.2rem; font-weight: 800; letter-spacing: 2px;">${state.inviteCode || '...'}</div>
    </div>`;

    // Dynamic Navigation Metrics (Main Visibility)
    if (state.myMarker && state.destinationMarker && state.currentRouteCoords.length > 0) {
        const myPos = state.myMarker.getLatLng();
        const roadDist = getRemainingDistance(myPos.lat, myPos.lng, state.currentRouteCoords);

        let remainingDuration = 0;
        if (state.currentRouteDistance > 0) {
            const ratio = roadDist / state.currentRouteDistance;
            remainingDuration = state.currentRouteDuration * ratio;
        }

        const km = (roadDist / 1000).toFixed(1);
        const mins = Math.ceil(remainingDuration / 60);

        const metricsHtml = `
            <div style="background: var(--primary); color: white; padding: 12px; border-radius: 12px; display: flex; justify-content: space-around; align-items: center; margin-top: 8px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.8;">Distance</div>
                    <div style="font-size: 1.2rem; font-weight: 700;">${km} km</div>
                </div>
                <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.3);"></div>
                <div style="text-align: center;">
                    <div style="font-size: 0.7rem; text-transform: uppercase; opacity: 0.8;">Arrival</div>
                    <div style="font-size: 1.2rem; font-weight: 700;">${mins} min</div>
                </div>
            </div>
        `;
        text += metricsHtml;

        // Update Summary Text
        if (summaryEl) summaryEl.innerText = `${km}km • ${mins}m`;
    } else {
        if (summaryEl) summaryEl.innerText = `Room: ${state.inviteCode}`;
    }

    if (infoEl) infoEl.innerHTML = text;
}

export function displaySearchResults(results, onSelect) {
    const container = document.getElementById("search-results");
    container.innerHTML = "";
    if (results.length === 0) {
        container.classList.add("hidden");
        return;
    }

    results.forEach(res => {
        const div = document.createElement("div");
        div.className = "search-item";
        div.innerText = res.display_name;
        div.onclick = () => {
            const lat = parseFloat(res.lat);
            const lon = parseFloat(res.lon);
            onSelect(lat, lon, res.display_name);
            container.classList.add("hidden");
        };
        container.appendChild(div);
    });
    container.classList.remove("hidden");
}

export function updateGroupStats() {
    if (!state.myMarker || !state.roomLeaderId) return;
    document.getElementById("group-stats").classList.remove("hidden");

    const riderListEl = document.getElementById("rider-list");
    riderListEl.innerHTML = "";

    const myPos = state.myMarker.getLatLng();
    const allPoints = [myPos];
    const riders = [];

    // 1. Calculate distances and collect points for spread
    Object.keys(state.otherUsers).forEach(id => {
        const pos = state.otherUsers[id].marker.getLatLng();
        const dist = getDistance(myPos.lat, myPos.lng, pos.lat, pos.lng);
        const isLdr = (id === state.roomLeaderId);

        riders.push({
            id,
            name: state.otherUsers[id].username,
            distance: dist,
            speed: state.otherUsers[id].speed,
            isLeader: isLdr,
            pos: pos
        });
        allPoints.push(pos);
    });

    // Sort riders by distance from me
    riders.sort((a, b) => a.distance - b.distance);

    // 2. Render Rider List
    riders.forEach(r => {
        const distStr = r.distance > 1000 ? (r.distance / 1000).toFixed(1) + "km" : Math.round(r.distance) + "m";
        const item = document.createElement("div");
        item.className = "stats-item";
        item.innerHTML = `
            <span class="stats-label">${r.name}${r.isLeader ? ' (Ldr)' : ''}</span>
            <span class="stats-value">→ ${distStr}</span>
        `;
        riderListEl.appendChild(item);
    });

    // 3. Group Spread (Radius from Center)
    if (allPoints.length > 1) {
        // Calculate Average Center
        let sumLat = 0, sumLng = 0;
        allPoints.forEach(p => { sumLat += p.lat; sumLng += p.lng; });
        const center = { lat: sumLat / allPoints.length, lng: sumLng / allPoints.length };

        // Find Radius (Max distance from center)
        let maxDist = 0;
        allPoints.forEach(p => {
            const d = getDistance(center.lat, center.lng, p.lat, p.lng);
            if (d > maxDist) maxDist = d;
        });

        document.getElementById("group-spread").innerText = maxDist > 1000 ? (maxDist / 1000).toFixed(1) + "km" : Math.round(maxDist) + "m";

        if (state.spreadHull) state.map.removeLayer(state.spreadHull);
        state.spreadHull = L.circle(center, {
            radius: maxDist,
            color: '#94a3b8',
            weight: 1,
            fillOpacity: 0.05,
            dashArray: '5, 5'
        }).addTo(state.map);
    }

    // 4. Speed Alerts (Optimized)
    const alertsEl = document.getElementById("speed-alerts");
    alertsEl.innerHTML = "";
    const speeds = [{ name: "You", speed: state.mySpeed }];
    riders.forEach(r => speeds.push({ name: r.name, speed: r.speed }));

    const avgSpeed = speeds.reduce((acc, s) => acc + s.speed, 0) / speeds.length;
    if (avgSpeed > 5) { // Only show alerts if group is moving
        speeds.forEach(s => {
            if (s.speed > avgSpeed * 1.5 && s.speed > 8) {
                alertsEl.innerHTML += `<div class="stats-item"><span class="stats-label">${s.name}</span> <span class="speed-tag speed-fast">TOO FAST</span></div>`;
            } else if (s.speed < avgSpeed * 0.5) {
                alertsEl.innerHTML += `<div class="stats-item"><span class="stats-label">${s.name}</span> <span class="speed-tag speed-slow">LAGGING</span></div>`;
            }
        });
    }
}

export function toggleStats() {
    const el = document.getElementById("group-stats");
    el.classList.toggle("collapsed");
}
