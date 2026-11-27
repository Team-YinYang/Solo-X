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

test("workspace includes wallet, creation, and test-only minting panels", () => {
  const source = fs.readFileSync(path.join(app, "app/workspace/page.tsx"), "utf8");
  assert.match(source, /WalletPanel/);
  assert.match(source, /CreateCurrencyPanel/);
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

test("workspace includes conversion, transfer, and RPC reserve transparency tools", () => {
  const workspace = fs.readFileSync(path.join(app, "app/workspace/page.tsx"), "utf8");
  const operations = fs.readFileSync(path.join(app, "components/conversion-transfer-panel.tsx"), "utf8");
  const dashboard = fs.readFileSync(path.join(app, "components/reserve-dashboard.tsx"), "utf8");
  assert.match(workspace, /ConversionTransferPanel/);
  assert.match(workspace, /ReserveDashboard/);
  assert.match(operations, /Convert compatible currency/);
  assert.match(operations, /TransactionReview/);
  assert.match(operations, /flow\.recheck\(\)/);
  assert.match(dashboard, /Reserve ratio/);
  assert.match(dashboard, /Mint in explorer/);
});

test("ordinary token creation remains separate from backed Solo-X flows", () => {
  const workspace = fs.readFileSync(path.join(app, "app/workspace/page.tsx"), "utf8");
  const source = fs.readFileSync(path.join(app, "components/ordinary-token-panel.tsx"), "utf8");
  assert.match(workspace, /OrdinaryTokenPanel/);
  assert.match(source, /not backed, redeemable, or convertible/);
  assert.match(source, /never creates a Solo-X currency state or collateral vault/);
});

test("metadata is optional, address-first, and rejects unsafe branding URLs", () => {
  const workspace = fs.readFileSync(path.join(app, "app/workspace/page.tsx"), "utf8");
  const source = fs.readFileSync(path.join(app, "components/currency-metadata-panel.tsx"), "utf8");
  assert.match(workspace, /CurrencyMetadataPanel/);
  assert.match(source, /url.protocol === "https:"/);
  assert.match(source, /Duplicate names are allowed/);
  assert.match(source, /cannot change backing/);
});

test("environment example contains only public devnet configuration", () => {
  const env = fs.readFileSync(path.join(root, ".env.example"), "utf8");
  assert.match(env, /NEXT_PUBLIC_SOLANA_NETWORK=devnet/);
  assert.match(env, /https:\/\/api\.devnet\.solana\.com/);
  assert.doesNotMatch(env, /PRIVATE_KEY|SECRET_KEY|SEED_PHRASE/i);
});

test("currency creation requires consent, prepared wallet review and confirmed submission", () => {
  const source = fs.readFileSync(path.join(app, "components/create-currency-panel.tsx"), "utf8");
  const review = fs.readFileSync(path.join(app, "components/transaction-review.tsx"), "utf8");
  for (const pattern of [/!accepted/, /verifiedConnection/, /partialSign\(issued\)/, /TransactionReview/, /flow\.approve\(\)/, /flow\.recheck\(\)/, /cluster=devnet/]) assert.match(source, pattern);
  for (const pattern of [/wallet.signTransaction/, /skipPreflight: false/, /confirmTransaction/, /result.value.err/, /signedSignature/]) assert.match(review, pattern);
});
