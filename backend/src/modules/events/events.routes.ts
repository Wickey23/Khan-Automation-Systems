import { Router } from "express";

export const eventsRouter = Router();

eventsRouter.post("/", (req, res) => {
  // v1: optional sink for frontend analytics events.
  // eslint-disable-next-line no-console
  console.log("[event]", req.body);
  res.json({ ok: true });
});
