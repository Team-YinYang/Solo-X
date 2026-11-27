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

test("workspace contains wallet and devnet mint/redeem panels", () => {
  const source = fs.readFileSync(path.join(app, "app/workspace/page.tsx"), "utf8");
  assert.match(source, /WalletPanel/);
  assert.match(source, /MintRedeemPanel/);
  assert.match(source, /Devnet and local validator only/);
  assert.match(source, /Mint and redeem using test funds only/);
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
