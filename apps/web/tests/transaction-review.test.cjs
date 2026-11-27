const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const components = path.join(__dirname, "../components");

test("all transaction panels offer review and unresolved status reconciliation", () => {
  for (const file of ["create-currency-panel.tsx", "mint-redeem-panel.tsx", "conversion-transfer-panel.tsx"]) {
    const source = fs.readFileSync(path.join(components, file), "utf8");
    assert.match(source, /TransactionReview/, file);
    assert.match(source, /flow\.start\(prepare\)/, file);
    assert.match(source, /flow\.approve\(\)/, file);
    assert.match(source, /flow\.recheck\(\)/, file);
    assert.match(source, /flow\.blocked/, file);
  }
});

test("submission is signature-locked before RPC broadcast and does not auto-retry", () => {
  const source = fs.readFileSync(path.join(components, "transaction-review.tsx"), "utf8");
  const lockPosition = source.indexOf("unresolved.current = attempt");
  const sendPosition = source.indexOf("connection.sendRawTransaction");
  assert.ok(lockPosition > 0 && sendPosition > lockPosition);
  assert.match(source, /searchTransactionHistory|reconcileTransaction/);
  assert.match(source, /getBlockHeight/);
  assert.match(source, /skipPreflight: false/);
});
