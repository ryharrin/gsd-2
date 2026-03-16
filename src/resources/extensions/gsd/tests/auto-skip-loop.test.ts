import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const autoPath = join(__dirname, "..", "auto.ts");
const autoSrc = readFileSync(autoPath, "utf-8");

test("skip-loop helper accounts for lifetime dispatches before redispatch", () => {
  const helperStart = autoSrc.indexOf("async function advancePastVerifiedSkip(");
  const helperEnd = autoSrc.indexOf("async function dispatchNextUnit(");
  assert.ok(helperStart > 0, "advancePastVerifiedSkip helper should exist");
  assert.ok(helperEnd > helperStart, "helper should appear before dispatchNextUnit");

  const helperBlock = autoSrc.slice(helperStart, helperEnd);
  assert.ok(
    helperBlock.includes("const lifetimeCount = (unitLifetimeDispatches.get(dispatchKey) ?? 0) + 1;"),
    "helper should increment lifetime dispatch count",
  );
  assert.ok(
    helperBlock.includes("unitLifetimeDispatches.set(dispatchKey, lifetimeCount);"),
    "helper should persist the updated lifetime count",
  );
  assert.ok(
    helperBlock.includes("if (lifetimeCount > MAX_LIFETIME_DISPATCHES)"),
    "helper should enforce the existing hard lifetime cap",
  );
  assert.ok(
    helperBlock.includes("await stopForHardLifetimeLoop(ctx, pi, unitType, unitId, basePath, lifetimeCount);"),
    "helper should stop through the shared hard-loop path before redispatch",
  );
});

test("completed-key skip branch uses shared skip helper instead of direct redispatch", () => {
  const branchStart = autoSrc.indexOf("if (completedKeySet.has(idempotencyKey)) {");
  const branchEnd = autoSrc.indexOf("// Fallback: if the idempotency key is missing");
  assert.ok(branchStart > 0, "completed-key skip branch should exist");
  assert.ok(branchEnd > branchStart, "completed-key skip branch should end before fallback branch");

  const branchBlock = autoSrc.slice(branchStart, branchEnd);
  assert.ok(
    branchBlock.includes("await advancePastVerifiedSkip("),
    "completed-key skip branch should use shared skip helper",
  );
  assert.ok(
    !branchBlock.includes("await dispatchNextUnit(ctx, pi);"),
    "completed-key skip branch should not redispatch directly",
  );
});

test("artifact-repair skip branch uses shared skip helper instead of direct redispatch", () => {
  const branchStart = autoSrc.indexOf("// Fallback: if the idempotency key is missing but the expected artifact already");
  const branchEnd = autoSrc.indexOf("// Stuck detection");
  assert.ok(branchStart > 0, "artifact-repair skip branch should exist");
  assert.ok(branchEnd > branchStart, "artifact-repair skip branch should end before stuck detection");

  const branchBlock = autoSrc.slice(branchStart, branchEnd);
  assert.ok(
    branchBlock.includes("await advancePastVerifiedSkip("),
    "artifact-repair skip branch should use shared skip helper",
  );
  assert.ok(
    !branchBlock.includes("await dispatchNextUnit(ctx, pi);"),
    "artifact-repair skip branch should not redispatch directly",
  );
});
