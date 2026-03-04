import assert from "node:assert/strict";
import test from "node:test";
import { isPrismaMissingColumnError } from "../prisma-errors";

test("detects Prisma missing-column error by code string", () => {
  const error = new Error("P2022: The column Lead.pipelineStage does not exist");
  assert.equal(isPrismaMissingColumnError(error), true);
});

test("returns false for non-schema errors", () => {
  const error = new Error("Connection timeout");
  assert.equal(isPrismaMissingColumnError(error), false);
});

test("detects missing-column shape via Prisma-like code property", () => {
  const error = { code: "P2022", message: "Column missing" } as unknown;
  assert.equal(isPrismaMissingColumnError(error), true);
});

test("does not misclassify unrelated Prisma codes", () => {
  const error = { code: "P2002", message: "Unique violation" } as unknown;
  assert.equal(isPrismaMissingColumnError(error), false);
});
