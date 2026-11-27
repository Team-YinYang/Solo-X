const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = path.join(__dirname, "..");
const root = path.join(app, "../..");

test("landing page links to workspace", () => {
  const source = fs.readFileSync(path.join(app, "app/page.tsx"), "utf8");
  assert.match(source, /href="\/workspace"/);
  assert.match(source, /Enter workspace/);
});

test("workspace includes wallet and currency creation panels", () => {
  const source = fs.readFileSync(path.join(app, "app/workspace/page.tsx"), "utf8");
  assert.match(source, /WalletPanel/);
  assert.match(source, /CreateCurrencyPanel/);
  assert.match(source, /Devnet and local validator only/);
});

test("wallet panel is restricted to test networks and handles rejected signatures", () => {
  const source = fs.readFileSync(path.join(app, "components/wallet-panel.tsx"), "utf8");
  assert.match(source, /https:\/\/api\.devnet\.solana\.com/);
  assert.match(source, /network !== "devnet" && network !== "localnet"/);
  assert.match(source, /Wallet connection was cancelled or rejected/);
  assert.match(source, /Signature was cancelled or rejected/);
  assert.match(source, /Disconnect/);
});

test("environment example contains only public devnet configuration", () => {
  const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  assert.match(env, /NEXT_PUBLIC_SOLANA_NETWORK=devnet/);
  assert.match(env, /https:\/\/api\.devnet\.solana\.com/);
  assert.doesNotMatch(env, /PRIVATE_KEY|SECRET_KEY|SEED_PHRASE/i);
});

test("creation requires consent, wallet signatures, preflight and confirmation", () => {
  const source = fs.readFileSync(path.join(app, "components/create-currency-panel.tsx"), "utf8");
  for (const pattern of [/!accepted/, /verifiedConnection/, /partialSign\(issued\)/, /wallet.signTransaction/, /skipPreflight: false/, /confirmTransaction/, /result.value.err/, /cluster=devnet/]) assert.match(source, pattern);
});
