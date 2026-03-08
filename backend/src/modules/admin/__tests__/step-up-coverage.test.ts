import assert from "node:assert/strict";
import test from "node:test";
import type { Router } from "express";
import { adminRouter } from "../admin.routes";
import { requireStepUp } from "../../../middleware/require-step-up";

function getRouteStack(router: Router, path: string, method: "post" | "patch") {
  const layer = (router as any).stack.find((entry: any) => entry?.route?.path === path && entry.route.methods?.[method]);
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  return layer.route.stack || [];
}

function routeIncludesHandler(router: Router, path: string, method: "post" | "patch", handler: unknown) {
  return getRouteStack(router, path, method).some((entry: any) => entry?.handle === handler);
}

test("critical admin org mutation routes include requireStepUp", () => {
  assert.equal(routeIncludesHandler(adminRouter, "/orgs/:id/go-live", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/orgs/:id/pause", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/orgs/:id/status", "patch", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/orgs/:id/twilio/assign-number", "post", requireStepUp), true);
});

test("destructive and repair admin routes include requireStepUp", () => {
  assert.equal(routeIncludesHandler(adminRouter, "/system/clear-data", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/orgs/:id/repair/relink-call", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/orgs/:id/repair/merge-leads", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/orgs/:id/users/:userId/reset-password", "post", requireStepUp), true);
});
