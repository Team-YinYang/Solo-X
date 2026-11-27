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

test("workspace indicates there are no live transactions", () => {
  const source = fs.readFileSync(path.join(app, "app/workspace/page.tsx"), "utf8");
  assert.match(source, /Transactions are not enabled/);
  assert.match(source, /No wallet connection/);
});

test("environment example contains only public devnet configuration", () => {
  const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  assert.match(env, /NEXT_PUBLIC_SOLANA_NETWORK=devnet/);
  assert.match(env, /https:\/\/api\.devnet\.solana\.com/);
  assert.doesNotMatch(env, /PRIVATE_KEY|SECRET_KEY|SEED_PHRASE/i);
});
