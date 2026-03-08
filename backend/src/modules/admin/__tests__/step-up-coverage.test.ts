import assert from "node:assert/strict";
import test from "node:test";
import type { Router } from "express";
import { adminRouter } from "../admin.routes";
import { requireStepUp } from "../../../middleware/require-step-up";

function getRouteStack(router: Router, path: string, method: "post" | "patch" | "delete") {
  const layer = (router as any).stack.find((entry: any) => entry?.route?.path === path && entry.route.methods?.[method]);
  if (!layer) throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  return layer.route.stack || [];
}

function routeIncludesHandler(router: Router, path: string, method: "post" | "patch" | "delete", handler: unknown) {
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

test("remaining admin mutating routes include requireStepUp", () => {
  assert.equal(routeIncludesHandler(adminRouter, "/leads/:id", "patch", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/leads/:id", "delete", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/calls/:id", "delete", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/prospects", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/prospects/:id", "patch", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/prospects/:id", "delete", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/prospects/import-csv", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/prospects/discover", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/prospects/:id/score", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/prospects/:id/convert-to-lead", "post", requireStepUp), true);
  assert.equal(routeIncludesHandler(adminRouter, "/clients/:id/status", "patch", requireStepUp), true);
});
