#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_GATES = Object.freeze([
  "upgrade-authority",
  "independent-audit",
  "security-tests",
  "incident-response",
  "collateral-risk",
  "legal-compliance",
  "operations-monitoring",
  "release-approval",
]);

/**
 * Validate release-gate evidence, failing closed on unknown or incomplete data.
 * This is an advisory repository check: it does NOT enforce chain deployment or
 * replace independent security, legal, or multisig approval.
 */
function assessReadiness(document) {
  const problems = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return { ready: false, problems: ["Readiness manifest must be an object."] };
  }
  if (document.schemaVersion !== 1) problems.push("Unsupported schemaVersion.");
  if (document.network !== "devnet" && document.network !== "mainnet-beta") {
    problems.push("network must be devnet or mainnet-beta.");
  }
  if (typeof document.mainnetAuthorized !== "boolean") {
    problems.push("mainnetAuthorized must be boolean.");
  }
  if (typeof document.policy !== "string" || !document.policy.trim()) {
    problems.push("policy document link is required.");
  }
  if (!Array.isArray(document.gates)) {
    return { ready: false, problems: [...problems, "gates must be an array."] };
  }

  const ids = new Set();
  for (const gate of document.gates) {
    if (!gate || typeof gate !== "object" || Array.isArray(gate)) {
      problems.push("Invalid gate object.");
      continue;
    }
    if (typeof gate.id !== "string" || !REQUIRED_GATES.includes(gate.id)) {
      problems.push("Unexpected gate ID.");
      continue;
    }
    if (ids.has(gate.id)) problems.push(`Duplicate gate: ${gate.id}`);
    ids.add(gate.id);
    if (typeof gate.owner !== "string" || !gate.owner.trim()) {
      problems.push(`Missing accountable owner: ${gate.id}`);
    }
    if (typeof gate.criterion !== "string" || !gate.criterion.trim()) {
      problems.push(`Missing acceptance criterion: ${gate.id}`);
    }
    if (typeof gate.approved !== "boolean") {
      problems.push(`Invalid approval value: ${gate.id}`);
    } else if (!gate.approved) {
      problems.push(`Pending approval: ${gate.id}`);
    }
    if (!Array.isArray(gate.evidence) ||
        gate.evidence.length === 0 ||
        !gate.evidence.every((entry) => typeof entry === "string" && entry.trim())) {
      problems.push(`Missing evidence: ${gate.id}`);
    }
  }
  for (const id of REQUIRED_GATES) {
    if (!ids.has(id)) problems.push(`Required gate absent: ${id}`);
  }
  if (document.gates.length !== REQUIRED_GATES.length) {
    problems.push("Gate count does not match the required policy.");
  }
  if (document.network !== "mainnet-beta") {
    problems.push("Configured network is not mainnet-beta.");
  }
  if (document.mainnetAuthorized !== true) {
    problems.push("Explicit mainnet authorization is absent.");
  }
  return { ready: problems.length === 0, problems };
}

function main(args = process.argv.slice(2)) {
  const file = path.resolve(__dirname, "../../docs/launch-gates.json");
  let document;
  try {
    document = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error("Unable to load readiness manifest:", error.message);
    return 1;
  }
  const result = assessReadiness(document);
  if (args.includes("--assert-mainnet")) {
    if (!result.ready) {
      console.error("MAINNET BLOCKED: release gates have not been approved.");
      for (const problem of result.problems) console.error(`- ${problem}`);
      return 1;
    }
    console.log("Manifest gates recorded as approved. Independent verification remains required.");
    return 0;
  }
  console.log(`Solo-X mainnet readiness: ${result.ready ? "RECORDED APPROVALS" : "NOT READY"}`);
  if (!result.ready) {
    for (const problem of result.problems) console.log(`- ${problem}`);
  }
  // Reporting is nonblocking on development CI; approval assertion is explicit.
  return 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { assessReadiness, REQUIRED_GATES, main };
