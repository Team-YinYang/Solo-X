const { test } = require("node:test");
const assert = require("node:assert/strict");
const { reconcileTransaction, signedSignature } = require("../components/transaction-status.ts");

const block = { blockhash: "example", lastValidBlockHeight: 100 };
const connection = (status, height = 80) => ({
  getSignatureStatuses: async (_sigs, opts) => {
    assert.equal(opts.searchTransactionHistory, true);
    return { value: [status] };
  },
  getBlockHeight: async () => height,
});

test("pending status, including processed after block expiry, blocks retries", async () => {
  assert.equal(await reconcileTransaction(connection({ confirmationStatus: "processed", err: null }, 120), "sig", block), "pending");
  assert.equal(await reconcileTransaction(connection(null, 100), "sig", block), "pending");
});

test("history-confirmed signatures reconcile correctly", async () => {
  assert.equal(await reconcileTransaction(connection({ confirmationStatus: "finalized", err: null }), "sig", block), "confirmed");
  assert.equal(await reconcileTransaction(connection({ confirmationStatus: "confirmed", err: null }), "sig", block), "confirmed");
});

test("explicit on-chain failure permits a new reviewed attempt", async () => {
  assert.equal(await reconcileTransaction(connection({ err: { InstructionError: [0, "InvalidArgument"] } }), "sig", block), "failed");
});

test("expired blockhash without any historical signature permits review again", async () => {
  assert.equal(await reconcileTransaction(connection(null, 101), "sig", block), "expired");
});

test("RPC errors fail closed", async () => {
  await assert.rejects(() => reconcileTransaction({
    getSignatureStatuses: async () => { throw new Error("RPC down"); },
    getBlockHeight: async () => 200,
  }, "sig", block), /RPC down/);
});

test("prebroadcast signature is stable base58 and rejects unsigned bytes", () => {
  const bytes = new Uint8Array(64); bytes[63] = 1;
  assert.equal(signedSignature(bytes), "1".repeat(63) + "2");
  assert.throws(() => signedSignature(new Uint8Array(64)), /not signed/);
  assert.throws(() => signedSignature(new Uint8Array(63)), /not signed/);
});
