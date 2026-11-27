const BPS = 10000n;
function value(lamports, price, confidence, age) {
  if (lamports < 0n || price <= 0n || confidence < 0n || confidence * BPS > price * 200n || age < 0n || age > 60n) throw Error("invalid oracle or collateral");
  return lamports * (price - confidence) / 1000000000n;
}
function canIssue(collateral, debt) { return debt >= 0n && collateral >= 0n && collateral * BPS >= debt * 18000n; }
function liquidatable(collateral, debt) { return debt > 0n && collateral * BPS < debt * 15000n; }
function shortfall(collateral, debt) { const covered = collateral * BPS / 11000n; return debt > covered ? debt - covered : 0n; }
module.exports = { value, canIssue, liquidatable, shortfall };
