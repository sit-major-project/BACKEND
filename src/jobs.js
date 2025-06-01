// src/jobs.js
import { v4 as uuidv4 } from "uuid";

class JobStore {
    constructor() {
        this.jobs = new Map();
    }

    /**
     * Create a new job for treeID. Returns the job object.
     * job.status will be "pending" initially.
     */
    create(treeID) {
        const jobID = uuidv4();
        const now = new Date().toISOString();
        const newJob = {
            jobID,
            treeID,
            status: "pending", // pending → sensorInProgress → sensorDone → analysisInProgress → analysisDone → failed
            createdAt: now,
            updatedAt: now,
            sensorData: null, // { N, P, K, timestamp }
            analysis: null, // placeholder for Gemini JSON
            error: null, // if anything fails
            chatHistory: [], // store chat messages if you implement that later
        };
        this.jobs.set(jobID, newJob);
        return newJob;
    }

    /**
     * Retrieve an existing job. Returns undefined if not found.
     */
    get(jobID) {
        return this.jobs.get(jobID);
    }

    /**
     * Update an existing job with partial data. Returns the updated job,
     * or null if jobID does not exist.
     */
    update(jobID, fields) {
        const job = this.jobs.get(jobID);
        if (!job) return null;
        const now = new Date().toISOString();
        Object.assign(job, fields);
        job.updatedAt = now;
        this.jobs.set(jobID, job);
        return job;
    }

    /**
     * (Optional) return all jobs as an array. Useful for debugging.
     */
    all() {
        return Array.from(this.jobs.values());
    }
}

export default new JobStore();
