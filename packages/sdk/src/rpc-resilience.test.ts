import assert from "node:assert/strict";
import { test } from "node:test";
import { isTransientSoloXRpcError, readSoloXRpcWithRetry, reconcileSoloXConfirmation, SoloXRpcReadError, SoloXSubmissionTracker } from "./rpc-resilience.js";

test("429 and temporary outage recover with bounded exponential backoff", async () => {
  let calls = 0;
  const waits: number[] = [];
  const value = await readSoloXRpcWithRetry(async () => {
    calls++;
    if (calls === 1) throw { status: 429 };
    if (calls === 2) throw { statusCode: 503 };
    return { value: { reserves: 9n }, observedAt: 800 };
  }, { now: () => 1000, maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 15, maxAgeMs: 100, sleep: async (ms) => { waits.push(ms); } });
  assert.deepEqual(waits, [10, 15]);
  assert.equal(calls, 3);
  assert.equal(value.value.reserves, 9n);
  assert.equal(value.stale, true);
  assert.equal(value.ageMs, 200);
  assert.equal(value.attempts, 3);
});

test("fresh reads are explicit, and rate-limited reads stop at attempt limit", async () => {
  const fresh = await readSoloXRpcWithRetry(async () => ({ value: "ok" }), { now: () => 500 });
  assert.equal(fresh.stale, false);
  assert.equal(fresh.observedAt, 500);
  let calls = 0;
  await assert.rejects(() => readSoloXRpcWithRetry(async () => {
    calls++;
    throw { code: "ECONNRESET" };
  }, { maxAttempts: 2, initialDelayMs: 0, sleep: async () => {} }),
  (error: unknown) => error instanceof SoloXRpcReadError && error.attempts === 2);
  assert.equal(calls, 2);
});

test("non-transient errors do not get retried and invalid config fails fast", async () => {
  let calls = 0;
  await assert.rejects(() => readSoloXRpcWithRetry(async () => {
    calls++;
    throw new Error("Account owner mismatch");
  }, { sleep: async () => {} }), (error: unknown) => error instanceof SoloXRpcReadError && error.attempts === 1);
  assert.equal(calls, 1);
  assert.equal(isTransientSoloXRpcError({ status: 400 }), false);
  await assert.rejects(() => readSoloXRpcWithRetry(async () => ({ value: 3 }), { maxAttempts: 0 }), RangeError);
});

const rpc = (status: { err: unknown; confirmationStatus?: "processed" | "confirmed" | "finalized" } | null, height = 50) => ({
  getSignatureStatuses: async (signatures: readonly string[], options: { searchTransactionHistory: true }) => {
    assert.deepEqual(signatures, ["signature"]);
    assert.deepEqual(options, { searchTransactionHistory: true });
    return { value: [status] };
  },
  getBlockHeight: async (commitment: "confirmed") => { assert.equal(commitment, "confirmed"); return height; },
});

test("confirmation explicitly distinguishes pending, success, failure and expiry", async () => {
  assert.deepEqual(await reconcileSoloXConfirmation(rpc(null), "signature", 60), { signature: "signature", state: "submitted", canReviewNewAttempt: false });
  assert.equal((await reconcileSoloXConfirmation(rpc({ err: null, confirmationStatus: "processed" }, 100), "signature", 60)).state, "processed");
  assert.equal((await reconcileSoloXConfirmation(rpc({ err: null, confirmationStatus: "confirmed" }), "signature", 60)).state, "confirmed");
  assert.equal((await reconcileSoloXConfirmation(rpc({ err: null, confirmationStatus: "finalized" }), "signature", 60)).state, "finalized");
  assert.equal((await reconcileSoloXConfirmation(rpc({ err: { InstructionError: [0, "Custom"] } }), "signature", 60)).canReviewNewAttempt, true);
  assert.deepEqual(await reconcileSoloXConfirmation(rpc(null, 61), "signature", 60), { signature: "signature", state: "expired", canReviewNewAttempt: true });
});

test("RPC history outage or malformed status stays unknown, never greenlights retry", async () => {
  const broken = { getSignatureStatuses: async () => { throw new Error("RPC offline"); }, getBlockHeight: async () => 200 };
  const unknown = await reconcileSoloXConfirmation(broken, "signature", 60);
  assert.equal(unknown.state, "unknown");
  assert.equal(unknown.canReviewNewAttempt, false);
  assert.equal((await reconcileSoloXConfirmation({ ...rpc(null), getBlockHeight: async () => { throw new Error("outage"); } }, "signature", 60)).state, "unknown");
});

test("submitOnce never blindly resubmits after ambiguous RPC failure", async () => {
  const tracker = new SoloXSubmissionTracker();
  let sends = 0;
  const client = { ...rpc(null, 51), sendRawTransaction: async (_bytes: Uint8Array, options: { skipPreflight: false; maxRetries: 0 }) => {
    assert.deepEqual(options, { skipPreflight: false, maxRetries: 0 });
    sends++;
    throw new Error("connection lost after send");
  }};
  const bytes = Uint8Array.from([2, 4, 6]);
  const [a, b] = await Promise.all([tracker.submitOnce(client, "signature", bytes), tracker.submitOnce(client, "signature", bytes)]);
  assert.equal(a.state, "unknown");
  assert.deepEqual(a, b);
  assert.equal((await tracker.submitOnce(client, "signature", bytes)).state, "unknown");
  assert.equal(sends, 1);
  const status = await tracker.reconcile(client, "signature", 50);
  assert.equal(status.state, "expired");
  assert.equal(status.canReviewNewAttempt, true);
  assert.equal(sends, 1);
  assert.equal((await tracker.submitOnce(client, "signature", bytes)).state, "expired");
  assert.equal(sends, 1);
});

test("successful broadcast is single shot; wrong RPC signature is ambiguous", async () => {
  const tracker = new SoloXSubmissionTracker();
  let sends = 0;
  const client = { ...rpc({ err: null, confirmationStatus: "confirmed" }), sendRawTransaction: async () => { sends++; return "different"; } };
  assert.equal((await tracker.submitOnce(client, "signature", new Uint8Array([1]))).state, "unknown");
  assert.equal(sends, 1);
  assert.equal((await tracker.reconcile(client, "signature", 50)).state, "confirmed");
  await assert.rejects(() => tracker.reconcile(client, "missing", 50), /Unknown submission/);
});
