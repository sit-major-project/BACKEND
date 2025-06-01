// src/index.js
import express from "express";
import http from "http";
import cors from "cors";

import jobStore from "./jobs.js";
import mqttClient from "./mqttClient.js";
import { setupWebSocket, getIO } from "./websocket.js";
import { analyzeWithGemini, chatWithGemini } from "./gemini.js"; // <— real calls
import measurementRouter from "./routes/measurement.js";
import { config } from "dotenv";

config();

import { SERVER_PORT, API_PREFIX, ALLOWED_ORIGINS } from "./config.js";

// ────────────────────────────────────────────────────────────────────────────
// 1) Create Express app and configure it (CORS, JSON parsing, routers)
// ────────────────────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json()); // built-in body parser

// (Optional) Mount the measurementRouter at /api/v1/…
// This is just a placeholder; right now we’re not using REST to start jobs.
app.use(`${API_PREFIX}`, measurementRouter);

// Basic root route (just for sanity)
app.get("/", (req, res) => {
    res.send("🌴 Coconut Back-End is running (WebSocket + MQTT)!");
});

// ────────────────────────────────────────────────────────────────────────────
// 2) Create HTTP server and attach Socket.io under WS_PATH
// ────────────────────────────────────────────────────────────────────────────
const server = http.createServer(app);
setupWebSocket(server); // attaches Socket.io to the HTTP server
const io = getIO(); // get the Socket.io instance for broadcasting

// ────────────────────────────────────────────────────────────────────────────
// 3) MQTT “message” handler: listen for npk/read/response/{jobID}
// ────────────────────────────────────────────────────────────────────────────
mqttClient.on("message", (topic, messageBuffer) => {
    const parts = topic.split("/");
    const jobID = parts[parts.length - 1]; // last segment

    let payload;
    try {
        payload = JSON.parse(messageBuffer.toString());
    } catch (err) {
        console.error(`❌ Invalid JSON on MQTT topic ${topic}:`, err);
        return;
    }

    console.log("🔔 MQTT response for job:", payload);

    // 3a) Update job → sensorDone
    jobStore.update(jobID, {
        status: "sensorDone",
        sensorData: {
            N: payload.N_ppm,
            P: payload.P_ppm,
            K: payload.K_ppm,
            timestamp: payload.timestamp,
        },
    });

    // 3b) Broadcast WS “sensorDone” event to room jobUpdates/{jobID}
    io.to(`jobUpdates/${jobID}`).emit("jobUpdate", {
        action: "sensorDone",
        jobID,
        data: jobStore.get(jobID).sensorData,
    });

    // 3c) Start LLM analysis
    jobStore.update(jobID, { status: "analysisInProgress" });
    io.to(`jobUpdates/${jobID}`).emit("jobUpdate", {
        action: "analysisInProgress",
        jobID,
    });

    // 3d) Build a prompt for Gemini (replace with your real prompt builder)
    const { treeID, sensorData } = jobStore.get(jobID);

    analyzeWithGemini(treeID, sensorData)
        .then((geminiJson) => {
            // 5) Update job → analysisDone
            jobStore.update(jobID, {
                status: "analysisDone",
                analysis: geminiJson,
            });

            // 6) Broadcast WS “analysisDone”
            io.to(`jobUpdates/${jobID}`).emit("jobUpdate", {
                action: "analysisDone",
                jobID,
                data: geminiJson,
            });
        })
        .catch((err) => {
            console.error("❌ Gemini analysis failed:", err.message);
            jobStore.update(jobID, { status: "failed", error: err.message });
            io.to(`jobUpdates/${jobID}`).emit("jobUpdate", {
                action: "analysisFailed",
                jobID,
                data: { reason: err.message },
            });
        });
});
// ────────────────────────────────────────────────────────────────────────────
// 4) Handle WebSocket “command” messages from clients
//    (e.g. { action: "startMeasurement", treeID: "coconut-tree-23" })
// ────────────────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
    console.log("🟢 WS client connected:", socket.id);

    // a) Subscribe request: join room “jobUpdates/{jobID}”
    socket.on("subscribe", ({ jobID }) => {
        console.log(`Socket ${socket.id} joining jobUpdates/${jobID}`);
        socket.join(`jobUpdates/${jobID}`);

        // If job already exists, immediately send its current status
        const existingJob = jobStore.get(jobID);
        if (existingJob) {
            socket.emit("jobUpdate", {
                action: "jobStatus",
                jobID,
                data: {
                    status: existingJob.status,
                    sensorData: existingJob.sensorData,
                    analysis: existingJob.analysis,
                    error: existingJob.error,
                },
            });
        }
    });

    // b) Unsubscribe request: leave room
    socket.on("unsubscribe", ({ jobID }) => {
        console.log(`Socket ${socket.id} leaving jobUpdates/${jobID}`);
        socket.leave(`jobUpdates/${jobID}`);
    });

    // c) “command” events from FE
    socket.on("command", (msg) => {
        const { action, treeID, jobID, message } = msg;

        // ────────────────────────────────────────────────────────────────────────────
        // 4.1) action: startMeasurement
        // ────────────────────────────────────────────────────────────────────────────
        if (action === "startMeasurement") {
            if (!treeID) {
                return socket.emit("jobUpdate", {
                    action: "measurementFailed",
                    jobID: null,
                    data: { reason: "Missing treeID" },
                });
            }

            // 1) Create a new job
            const newJob = jobStore.create(treeID);
            const newJobID = newJob.jobID;

            // 2) Update status → sensorInProgress
            jobStore.update(newJobID, { status: "sensorInProgress" });

            // 3) Immediately let FE know we started
            socket.emit("jobUpdate", {
                action: "measurementStarted",
                jobID: newJobID,
                data: { status: "sensorInProgress" },
            });

            // 4) Publish MQTT request: npk/read/request/{treeID}/{newJobID}
            const topic = `npk/read/request/${treeID}/${newJobID}`;
            const payload = JSON.stringify({ timestamp: newJob.createdAt });
            mqttClient.publish(topic, payload, (err) => {
                if (err) {
                    console.error("❌ MQTT publish failed:", err);
                    jobStore.update(newJobID, {
                        status: "failed",
                        error: "MQTT publish error",
                    });
                    socket.emit("jobUpdate", {
                        action: "measurementFailed",
                        jobID: newJobID,
                        data: {
                            reason: "Could not send MQTT request to ESP32",
                        },
                    });
                } else {
                    console.log(`📨 MQTT request published to ${topic}`);
                }
            });

            return; // do not fall through to other actions
        }

        // ────────────────────────────────────────────────────────────────────────────
        // 4.2) action: chat (follow-up after analysisDone)
        // ────────────────────────────────────────────────────────────────────────────
        else if (action === "chat") {
            if (!jobID || !message) {
                return socket.emit("jobUpdate", {
                    action: "chatFailed",
                    jobID: jobID || null,
                    data: { reason: "Missing jobID or message" },
                });
            }
            const job = jobStore.get(jobID);
            if (!job || job.status !== "analysisDone") {
                return socket.emit("jobUpdate", {
                    action: "chatFailed",
                    jobID,
                    data: {
                        reason: `Job ${jobID} not found or not ready for chat`,
                    },
                });
            }

            // Build a chat prompt (incorporate job.analysis and the user’s message)
            const prompt = `
        Previous analysis for tree ${job.treeID}: ${JSON.stringify(
                job.analysis
            )};
        Now user asks: "${message}". Respond with JSON: { "answer": "..." }.
      `;

            chatWithGemini(prompt)
                .then((geminiResponse) => {
                    // geminiResponse should be { role, text } or similar
                    console.log("🤖 Gemini chat response:", geminiResponse);
                    io.to(`jobUpdates/${jobID}`).emit("jobUpdate", {
                        action: "chatReply",
                        jobID,
                        data: {
                            role: geminiResponse.role,
                            text: geminiResponse.text,
                        },
                    });
                })
                .catch((err) => {
                    console.error("❌ Gemini chat failed:", err);
                    socket.emit("jobUpdate", {
                        action: "chatFailed",
                        jobID,
                        data: { reason: err.message },
                    });
                });

            return;
        }

        // ────────────────────────────────────────────────────────────────────────────
        // 4.3) Unknown action
        // ────────────────────────────────────────────────────────────────────────────
        else {
            socket.emit("jobUpdate", {
                action: "error",
                jobID: jobID || null,
                data: { reason: `Unknown action: ${action}` },
            });
            return;
        }
    });

    socket.on("disconnect", () => {
        console.log("⚪ WS client disconnected:", socket.id);
    });
});

// ────────────────────────────────────────────────────────────────────────────
// 5) Start the HTTP + WebSocket server
// ────────────────────────────────────────────────────────────────────────────
server.listen(SERVER_PORT, () => {
    console.log(`🚀 Server listening on port ${SERVER_PORT}`);
});
