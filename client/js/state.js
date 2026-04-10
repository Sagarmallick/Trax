// Global Application State
export const state = {
    username: "",
    room: "",
    inviteCode: "",
    isLeader: false,
    roomLeaderName: "",
    roomLeaderId: "",
    currentStatus: "Not tracking",
    isDemoMode: false,
    isPerspectiveMode: false,
    myHeading: 0,
    myCompassHeading: 0,
    trackingInterval: null,

    // Navigation metrics
    currentRouteDistance: 0, // In meters
    currentRouteDuration: 0, // In seconds
    currentRouteCoords: [],

    map: null,
    routeLine: null,
    destinationMarker: null,
    rerouteLine: null,
    myMarker: null,
    myPrevPos: null,
    myLastTime: null,
    mySpeed: 0,
    otherUsers: {},
    spreadHull: null
};
