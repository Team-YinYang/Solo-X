"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { assessReadiness, REQUIRED_GATES, main } = require("./check-launch-gates.cjs");
const fs = require("node:fs");
const path = require("node:path");

const manifest = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, "../../docs/launch-gates.json"), "utf8",
));
const fixture = () => JSON.parse(JSON.stringify(manifest));
const approvedFixture = () => {
  const value = fixture();
  value.network = "mainnet-beta";
  value.mainnetAuthorized = true;
  for (const gate of value.gates) {
    gate.approved = true;
    gate.evidence = ["https://github.com/Team-YinYang/Solo-X/issues/20#issuecomment-example"];
  }
  return value;
};

test("repository is explicitly unapproved for mainnet", () => {
  assert.equal(manifest.network, "devnet");
  assert.equal(manifest.mainnetAuthorized, false);
  assert.deepEqual(manifest.gates.map((gate) => gate.id), REQUIRED_GATES);
  assert.equal(assessReadiness(manifest).ready, false);
  assert.equal(main(["--assert-mainnet"]), 1);
});

test("no single missing launch gate can be bypassed", () => {
  for (const id of REQUIRED_GATES) {
    const value = approvedFixture();
    value.gates = value.gates.filter((gate) => gate.id !== id);
    assert.equal(assessReadiness(value).ready, false, id);
  }
});

test("all gates require documented approval and nonempty evidence", () => {
  for (const id of REQUIRED_GATES) {
    const unapproved = approvedFixture();
    unapproved.gates.find((gate) => gate.id === id).approved = false;
    assert.equal(assessReadiness(unapproved).ready, false, id);
    const noEvidence = approvedFixture();
    noEvidence.gates.find((gate) => gate.id === id).evidence = [];
    assert.equal(assessReadiness(noEvidence).ready, false, id);
  }
});

test("rejects duplicate and unexpected gates", () => {
  const duplicate = approvedFixture();
  duplicate.gates[1].id = duplicate.gates[0].id;
  const result = assessReadiness(duplicate);
  assert.equal(result.ready, false);
  assert.ok(result.problems.some((message) => message.startsWith("Duplicate gate:")));

  const extra = approvedFixture();
  extra.gates.push({ id: "unrecognized", owner: "Nobody", criterion: "Bypass",
    approved: true, evidence: ["self-approved"] });
  assert.equal(assessReadiness(extra).ready, false);
});

test("denies malformed manifests and invalid approval flags", () => {
  for (const item of [null, [], {}, { ...approvedFixture(), gates: null }]) {
    assert.equal(assessReadiness(item).ready, false);
  }
  const malformed = approvedFixture();
  malformed.gates[0].approved = "true";
  malformed.gates[1].evidence = [""];
  malformed.mainnetAuthorized = "true";
  assert.equal(assessReadiness(malformed).ready, false);
});

test("report mode does not fail development CI; assert mode blocks", () => {
  assert.equal(main([]), 0);
  assert.equal(main(["--assert-mainnet"]), 1);
});

test("fully populated fixture is structurally approved, without implying an audit", () => {
  assert.equal(assessReadiness(approvedFixture()).ready, true);
});

// Include the proposed governance reference policy in the existing CI suite.
require("./governance-policy.test.cjs");
