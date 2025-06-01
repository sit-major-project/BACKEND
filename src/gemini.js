// src/gemini.js
/**
 * Temporarily stub out the Gemini call. Returns a fake analysis object
 * after a 1.5 second delay. Replace this with a real HTTP call later.
 */
export async function callGemini(prompt) {
    console.log("🔎 [Stub] Calling Gemini with prompt:", prompt);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                treeID: prompt.treeID || "unknown",
                nutrient_status: {
                    N: {
                        current_ppm: 120,
                        trend: "stable",
                        recommendation: "No N needed",
                    },
                    P: {
                        current_ppm: 45,
                        trend: "stable",
                        recommendation: "Apply 25g SSP in 2 days",
                    },
                    K: {
                        current_ppm: 180,
                        trend: "slightly falling",
                        recommendation: "Apply 50g KCl",
                    },
                },
                soil_secondary: {
                    pH: { current: 6.8, recommendation: "pH is ideal" },
                    moisture_pct: {
                        current: 32,
                        recommendation: "Irrigate in next 4h",
                    },
                },
                image_findings: {
                    top_prediction: "None yet",
                    confidence: 0.0,
                    note: "No image analysis performed",
                },
                overall_diagnosis: {
                    possible_conditions: ["Early Nitrogen Deficiency"],
                    priority: "medium",
                    next_actions: [
                        "Apply 50g KCl",
                        "Irrigate to raise moisture to 35%",
                        "Monitor next 3 days",
                    ],
                },
                timestamp: new Date().toISOString(),
            });
        }, 1500);
    });
}

/**
 * If you later want a “chat follow-up” stub:
 */
export async function chatWithGemini(previousAnalysis, userMessage) {
    console.log("🗨️ [Stub] Chat with Gemini. Msg:", userMessage);
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                role: "assistant",
                text: `Because K is 180 ppm and optimal is 200 ppm, it's slightly low. Monitor next cycle.`,
            });
        }, 800);
    });
}
