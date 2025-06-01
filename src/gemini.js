// src/gemini.js
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config(); // load GEMINI_API_KEY from .env if present

/**
 * Initialize the GoogleGenAI client with your API key.
 * Make sure you have set GEMINI_API_KEY in your environment.
 */
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// ────────────────────────────────────────────────────────────────────────────
// 1) analyzeWithGemini:
//     Given a treeID and its latest sensor data, ask Gemini to return
//     a structured JSON diagnosis per our schema.
// ────────────────────────────────────────────────────────────────────────────
export async function analyzeWithGemini(treeID, sensorData) {
    // sensorData: { N: number, P: number, K: number, timestamp: string }

    // Build a clear “system” + “user” prompt that forces JSON output
    const systemPrompt = `
You are an AI agronomist assistant. When asked to analyze coconut tree soil data, you must:
1. Return a JSON _exactly_ matching the schema below (no extra keys, no Markdown, no explanations).
2. If any value is missing, still include the key with a null or default.
3. Use ISO 8601 for any timestamps.
4. Do NOT include any commentary—only raw JSON.

Schema:
{
  "treeID": string,
  "nutrient_status": {
    "N": { "current_ppm": number, "trend": "rising"|"falling"|"stable", "recommendation": string },
    "P": { "current_ppm": number, "trend": "rising"|"falling"|"stable", "recommendation": string },
    "K": { "current_ppm": number, "trend": "rising"|"falling"|"stable", "recommendation": string }
  },
  "soil_secondary": {
    "pH": { "current": number, "recommendation": string },
    "moisture_pct": { "current": number, "recommendation": string }
  },
  "image_findings": {
    "top_prediction": string,   // e.g. "None" if no image
    "confidence": number,       // e.g. 0.0
    "note": string              // e.g. "No image provided"
  },
  "overall_diagnosis": {
    "possible_conditions": [ string ],
    "priority": "high"|"medium"|"low",
    "next_actions": [ string ]
  },
  "timestamp": string           // when the analysis is performed
}
`;

    // Now build the “user” content using the latest sensor reading.
    // (You can expand this with historical context if you like.)
    const userPrompt = `
Tree ID: ${treeID}
Latest sensor reading:
  N (ppm): ${sensorData.N}
  P (ppm): ${sensorData.P}
  K (ppm): ${sensorData.K}
  Timestamp: ${sensorData.timestamp}

Based on these values and typical coconut palm requirements:
- If N < 140, it is “falling” or “deficient.”
- If N is between 140–160, “stable/optimal.”
- If N > 160, “rising” or “excess.”
(similar logic for P, K—adjust these ranges as needed)
Also consider that ideal soil pH is 6.5–7.0 and moisture should be 35–45%.

Provide your output as valid JSON only, per the schema given above.
`;

    try {
        const fullPrompt = `${systemPrompt.trim()}\n\n${userPrompt.trim()}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash", // or "gemini-1.5-turbo" if available
            temperature: 0.0,
            // We’ll send “system” + “user” messages to guide the model.
            contents: fullPrompt,
        });

        // The API returns a top‐level `text` field containing the model output:
        const jsonText = response.text.trim();

        // Try to parse the JSON. If it fails, we’ll throw an error.
        let parsed;
        try {
            // Remove any leading/trailing Markdown-style backticks
            const cleanedJson = jsonText
                .replace(/^```json\s*/i, "") // remove starting ```json
                .replace(/^```\s*/i, "") // or generic ```
                .replace(/```$/, ""); // remove ending ```

            parsed = JSON.parse(cleanedJson.trim());
        } catch (err) {
            console.error("❌ Failed to parse JSON from Gemini:", jsonText);
            throw new Error("Gemini returned invalid JSON");
        }
        return parsed;
    } catch (err) {
        console.error("❌ Error during Gemini call:", err);
        throw err; // let the caller handle it
    }
}

// ────────────────────────────────────────────────────────────────────────────
// 2) chatWithGemini:
//     Given the previous analysis object (parsed JSON) and a user message,
//     ask Gemini to respond in JSON with { role: "assistant", text: "..." }.
// ────────────────────────────────────────────────────────────────────────────
export async function chatWithGemini(previousAnalysis, userMessage) {
    // previousAnalysis: the JSON object returned by analyzeWithGemini()
    // userMessage: e.g. "Why is K low?"

    const systemPrompt = `
You are an AI agronomist assistant. The user already has a soil analysis JSON for a coconut tree. 
When the user asks a follow-up question, respond with a valid JSON object:
{
  "role": "assistant",
  "text": string    // your answer in plain English
}
Do NOT include any extra keys or formatting—only return the JSON.
`;

    const userPrompt = `
Here is the previous analysis JSON:
${JSON.stringify(previousAnalysis)}

User question: "${userMessage}"

Provide your response as valid JSON only.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            temperature: 0.0,
            messages: [
                { role: "system", content: systemPrompt.trim() },
                { role: "user", content: userPrompt.trim() },
            ],
        });

        const jsonText = response.text.trim();
        let parsed;
        try {
            parsed = JSON.parse(jsonText);
        } catch (err) {
            console.error(
                "❌ Failed to parse chat JSON from Gemini:",
                jsonText
            );
            throw new Error("Gemini chat returned invalid JSON");
        }
        return parsed; // { role: "assistant", text: "..." }
    } catch (err) {
        console.error("❌ Error during Gemini chat call:", err);
        throw err;
    }
}
