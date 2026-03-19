import type { RequestHandler } from "express";

const noopRateLimiter: RequestHandler = (_req, _res, next) => next();

export const rateLimiters = {
  expensiveActionManual: noopRateLimiter
};
