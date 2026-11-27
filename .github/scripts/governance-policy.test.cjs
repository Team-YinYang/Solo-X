"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { DELAY_SECONDS, evaluateProposal, operationAllowed } = require("./governance-policy.cjs");
const roster = ["a", "b", "c", "d", "e"];
const proposal = { action: "upgrade", proposer: "a", approvals: ["b", "c", "d"],
  createdAt: 100, digest: "a".repeat(64), cancelled: false, executed: false };
const mature = 100 + DELAY_SECONDS;

test("routine upgrades and recovery require independent quorum and delay", () => {
  for (const action of ["upgrade", "rotate-signers", "resume-issuance"]) {
    const p = { ...proposal, action };
    assert.equal(evaluateProposal(p, mature - 1, roster), false);
    assert.equal(evaluateProposal(p, mature, roster), true);
  }
});
test("emergency pause requires quorum but not delay", () => {
  const p = { ...proposal, action: "pause-issuance" };
  assert.equal(evaluateProposal(p, 100, roster), true);
  assert.equal(evaluateProposal({ ...p, approvals: ["b", "c"] }, 100, roster), false);
});
test("rejects unauthorized, duplicate, self, cancelled and replayed proposals", () => {
  for (const patch of [
    { approvals: ["b", "c", "outsider"] }, { approvals: ["b", "b", "c"] },
    { approvals: ["a", "b", "c"] }, { cancelled: true }, { executed: true },
    { digest: "invalid" }, { action: "seize-reserves" }, { action: "pause-redemption" },
    { createdAt: mature + 1 }, { proposer: "outsider" },
  ]) assert.equal(evaluateProposal({ ...proposal, ...patch }, mature, roster), false);
  assert.equal(evaluateProposal(proposal, mature, ["a", "b", "c", "d", "d"]), false);
});
test("pause preserves redemption and transfers and never permits reserve seizure", () => {
  for (const paused of [true, false]) {
    for (const op of ["redeem", "transfer"]) assert.equal(operationAllowed(op, paused), true);
    for (const op of ["create", "mint", "convert"]) assert.equal(operationAllowed(op, paused), !paused);
    assert.equal(operationAllowed("seize-reserves", paused), false);
  }
});
