// src/config.js
export const SERVER_PORT = process.env.PORT || 3000;
export const MQTT_BROKER_URL =
    process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
export const WS_PATH = "/ws"; // where Socket.io will attach
export const ALLOWED_ORIGINS = [
    "http://localhost:5173", // adjust to your front-end dev URL (e.g. Vite/React)
    "http://localhost:3000", // if you ever serve static files or test with same origin
];
export const API_PREFIX = "/api/v1"; // for future REST endpoints
