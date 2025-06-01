// src/websocket.js
import { Server as IOServer } from "socket.io";
import { WS_PATH, ALLOWED_ORIGINS } from "./config.js";

let io = null;

/**
 * Call setupWebSocket(httpServer) once, after creating your HTTP server.
 * This attaches Socket.io under WS_PATH and enables CORS for ALLOWED_ORIGINS.
 */
export function setupWebSocket(httpServer) {
    io = new IOServer(httpServer, {
        path: WS_PATH,
        cors: {
            origin: ALLOWED_ORIGINS,
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        console.log("🟢 WS client connected:", socket.id);

        // Listen for subscription requests: { action: "subscribe", jobID }
        socket.on("subscribe", ({ jobID }) => {
            console.log(
                `Socket ${socket.id} subscribing to jobUpdates/${jobID}`
            );
            socket.join(`jobUpdates/${jobID}`);
        });

        socket.on("unsubscribe", ({ jobID }) => {
            console.log(
                `Socket ${socket.id} unsubscribing from jobUpdates/${jobID}`
            );
            socket.leave(`jobUpdates/${jobID}`);
        });

        socket.on("disconnect", () => {
            console.log("⚪ WS client disconnected:", socket.id);
        });
    });
}

/** Export the io instance so other modules (e.g. index.js) can do io.to(room).emit(...) */
export function getIO() {
    if (!io) {
        throw new Error(
            "Socket.io not initialized! Call setupWebSocket(server) first."
        );
    }
    return io;
}
