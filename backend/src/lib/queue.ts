import { Queue } from "bullmq";
import { redis } from "./redis";

const connection = redis as any;

// Queues
export const webhookQueue = new Queue("webhook-processing", { 
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 1000, // Keep last 1000 failed jobs
  }
});

export const outreachQueue = new Queue("outreach-send", { 
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "fixed",
      delay: 60000, // 1 minute
    },
    removeOnComplete: true,
  }
});

export const importQueue = new Queue("import-processing", { 
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: true,
    removeOnFail: 500,
  }
});

export const backgroundTasksQueue = new Queue("background-tasks", { 
  connection,
  defaultJobOptions: {
    removeOnComplete: true,
  }
});

export const calendarSyncQueue = new Queue("calendar-sync", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: true,
    removeOnFail: 1000,
  }
});

export const aiReplyQueue = new Queue("ai-reply", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30000 },
    removeOnComplete: true,
    removeOnFail: 500,
  }
});
