import assert from "node:assert/strict";
import { test } from "node:test";
import { SOLO_X_NETWORKS, createSoloXRpcConfig, isSoloXNetwork } from "./index.js";

test("only devnet and localnet are supported", () => {
  assert.deepEqual(SOLO_X_NETWORKS, ["localnet", "devnet"]);
  assert.equal(isSoloXNetwork("devnet"), true);
  assert.equal(isSoloXNetwork("localnet"), true);
  assert.equal(isSoloXNetwork("mainnet-beta"), false);
});

test("devnet RPC config is immutable", () => {
  const config = createSoloXRpcConfig("devnet");
  assert.deepEqual(config, { network: "devnet", endpoint: "https://api.devnet.solana.com", commitment: "confirmed" });
  assert.equal(Object.isFrozen(config), true);
});

test("localnet uses the local validator", () => {
  assert.equal(createSoloXRpcConfig("localnet").endpoint, "http://127.0.0.1:8899");
});

test("unexpected runtime networks fail closed", () => {
  assert.throws(() => createSoloXRpcConfig("mainnet-beta" as never), /only localnet or devnet/);
});
