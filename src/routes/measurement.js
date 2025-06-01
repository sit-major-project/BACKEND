// src/routes/measurement.js
import express from "express";
const router = express.Router();

/**
 * (Optional) GET /api/v1/health
 * A simple health check endpoint. Not strictly required, but handy.
 */
router.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * (Future) you might add:
 * POST /api/v1/startMeasurement  { treeID }
 * GET  /api/v1/job/:jobID/status
 * GET  /api/v1/tree/:treeID/history
 * etc.
 */

export default router;
