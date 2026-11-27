import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSoloXDecimalAmount, simulateSoloXTransaction, SoloXSimulationError } from "./preflight.js";
import { MAX_U64 } from "./transactions.js";

test("decimal parsing preserves exact base units and u64 boundary", () => {
  assert.equal(parseSoloXDecimalAmount("0.000001"), 1n);
  assert.equal(parseSoloXDecimalAmount("1.23"), 1230000n);
  assert.equal(parseSoloXDecimalAmount("9007199254.740993"), 9007199254740993n);
  assert.equal(parseSoloXDecimalAmount("18446744073709.551615"), MAX_U64);
});
test("invalid, zero, excess precision and overflow amounts are rejected", () => {
  for (const value of ["", "0", "0.000000", "-1", "+1", "1e3", " 1", "1 ", ".1", "1.", "1.0000000", "18446744073709.551616", "9999999999999999999999", "NaN", "Infinity"]) {
    assert.throws(() => parseSoloXDecimalAmount(value), { code: "INVALID_AMOUNT" });
  }
});
test("simulation returns logs and uses the supplied transaction", async () => {
  const tx = { id: 1 };
  const value = { err: null, logs: ["ok"], unitsConsumed: 123 };
  assert.equal(await simulateSoloXTransaction({ simulateTransaction: async (input) => { assert.equal(input, tx); return { value }; } }, tx), value);
});
test("simulation surfaces program failures and logs", async () => {
  const detail = { InstructionError: [0, { Custom: 42 }] };
  await assert.rejects(simulateSoloXTransaction({ simulateTransaction: async () => ({ value: { err: detail, logs: ["failed"] } }) }, {}), (error: unknown) => error instanceof SoloXSimulationError && error.kind === "TRANSACTION_ERROR" && error.detail === detail && error.logs[0] === "failed");
});
test("simulation surfaces transport and malformed response errors", async () => {
  const cause = new Error("offline");
  await assert.rejects(simulateSoloXTransaction({ simulateTransaction: async () => { throw cause; } }, {}), (error: unknown) => error instanceof SoloXSimulationError && error.kind === "RPC_ERROR" && error.detail === cause);
  await assert.rejects(simulateSoloXTransaction({ simulateTransaction: async () => ({ value: { err: undefined } }) }, {}), { kind: "RPC_ERROR" });
});
