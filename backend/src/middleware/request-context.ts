import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const fromHeader = req.header("x-request-id");
  req.requestId = fromHeader && fromHeader.trim() ? fromHeader.trim() : crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
}

