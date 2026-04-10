// Configuration and Icons
export const CONFIG = {
    DEFAULT_VIEW: [28.6139, 77.2090],
    DEFAULT_ZOOM: 13,
    PERSPECTIVE_ZOOM: 18,
    PRIMARY_COLOR: '#3b82f6',
    DESTINATION_ICON_URL: 'https://cdn-icons-png.flaticon.com/512/2776/2776067.png'
};

export const getCustomIcon = (color, isMe = false, heading = 0) => L.divIcon({
    className: 'custom-div-icon',
    html: `
        <div class="directional-icon" style="transform: rotate(${heading || 0}deg); position: relative;">
            <div style="background-color: ${color}; width: ${isMe ? '18px' : '14px'}; height: ${isMe ? '18px' : '14px'}; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 0 12px rgba(0,0,0,0.4);"></div>
            ${(isMe || heading) ? `<div class="bearing-arrow" style="border-bottom-color: ${color}"></div>` : ''}
        </div>
    `,
    iconSize: isMe ? [18, 18] : [14, 14],
    iconAnchor: isMe ? [9, 9] : [7, 7]
});

export const destIcon = L.icon({
    iconUrl: CONFIG.DESTINATION_ICON_URL,
    iconSize: [36, 36],
    iconAnchor: [18, 36]
});
