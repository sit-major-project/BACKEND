// src/mqttClient.js
import mqtt from "mqtt";
import { MQTT_BROKER_URL } from "./config.js";

const client = mqtt.connect(MQTT_BROKER_URL);

client.on("connect", () => {
    console.log("✅ Connected to MQTT broker:", MQTT_BROKER_URL);
    client.subscribe("npk/read/response/+", (err) => {
        if (err) {
            console.error("❌ MQTT subscribe error:", err);
        } else {
            console.log("🔔 Subscribed to topic: npk/read/response/+");
        }
    });
});

client.on("error", (err) => {
    console.error("❌ MQTT connection error:", err);
});

export default client;
