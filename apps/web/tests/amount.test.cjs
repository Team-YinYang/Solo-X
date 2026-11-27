const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const ts = require("typescript");
const source = readFileSync(join(__dirname, "../components/amount.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exportsObject = {};
new Function("exports", compiled)(exportsObject);
const { parseAmount, formatAmount } = exportsObject;
test("exact six-decimal conversion", () => {
  assert.equal(parseAmount("1.000001"), 1000001n);
  assert.equal(formatAmount(1000001n), "1.000001");
});
test("rejects invalid or overflowing amounts", () => {
  for (const value of ["0", "-1", "1e3", "1.0000001", "", "18446744073709.551616"]) assert.throws(() => parseAmount(value));
  assert.equal(parseAmount("18446744073709.551615"), 18446744073709551615n);
});
