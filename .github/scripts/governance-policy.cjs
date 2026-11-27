"use strict";

// Reference policy only: inputs must be authenticated by a future on-chain
// governance implementation. This module cannot authorize a real transaction.
const DELAY_SECONDS = 48 * 60 * 60;
const ACTIONS = new Set(["upgrade", "rotate-signers", "pause-issuance", "resume-issuance"]);

function evaluateProposal(p, now, roster) {
  if (!p || !ACTIONS.has(p.action) || !Array.isArray(roster) ||
      roster.length !== 5 || new Set(roster).size !== 5 ||
      roster.some((s) => typeof s !== "string" || !s) ||
      !Array.isArray(p.approvals) || !roster.includes(p.proposer) ||
      !Number.isSafeInteger(now) || now < 0 ||
      !Number.isSafeInteger(p.createdAt) || p.createdAt < 0 || now < p.createdAt ||
      p.cancelled !== false || p.executed !== false ||
      typeof p.digest !== "string" || !/^[a-f0-9]{64}$/.test(p.digest)) return false;
  const approvals = new Set(p.approvals);
  if (approvals.size !== p.approvals.length || approvals.has(p.proposer) ||
      [...approvals].some((s) => !roster.includes(s)) || approvals.size < 3) return false;
  return p.action === "pause-issuance" || now - p.createdAt >= DELAY_SECONDS;
}

function operationAllowed(operation, paused) {
  if (typeof paused !== "boolean") return false;
  if (operation === "redeem" || operation === "transfer") return true;
  return !paused && ["create", "mint", "convert"].includes(operation);
}

module.exports = { DELAY_SECONDS, evaluateProposal, operationAllowed };
