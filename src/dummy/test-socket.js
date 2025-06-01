import { io } from "socket.io-client";

const socket = io("http://localhost:3000", { path: "/ws" });

socket.on("connect", () => {
    console.log("🌐 WS connected, id:", socket.id);

    // 1. Start a measurement
    socket.emit("command", {
        action: "startMeasurement",
        treeID: "T23",
    });
});

socket.on("jobUpdate", (msg) => {
    console.log("← jobUpdate:", msg);

    if (msg.action === "measurementStarted") {
        const jobID = msg.jobID;

        // 2. Subscribe to the specific room
        socket.emit("subscribe", { jobID });
        console.log(`📡 Subscribed to jobUpdates/${jobID}`);
    }

    // 3. Handle any job update (sensorDone, analysisInProgress, etc.)
    if (msg.action === "sensorDone") {
        console.log("✅ Sensor reading received:", msg.data);
    }

    if (msg.action === "analysisDone") {
        console.log("🧠 Gemini analysis completed:", msg.data);
    }
});



// dummy mqtt response
// iamrpm@rpm:~/BACKEND$ mosquitto_pub -t "npk/read/response/79928184-d9bb-4c3f-a0a8-3b5cb0448266" -m '{
//     "jobID": "79928184-d9bb-4c3f-a0a8-3b5cb0448266",
//     "treeID": "T23",
//     "timestamp": "2025-06-05T10:15:00Z",
//     "N_ppm": 123.0,
//     "P_ppm":  47.5,
//     "K_ppm": 178.2
//   }'
//   iamrpm@rpm:~/BACKEND$
