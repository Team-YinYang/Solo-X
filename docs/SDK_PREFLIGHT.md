# Exact amounts and preflight

Use `parseSoloXDecimalAmount("1.25")` to obtain `1250000n` for the existing mint, redeem and convert builders. Inputs must be positive decimal strings with at most six fractional digits and fit a u64. Do not convert balances to JavaScript numbers. Existing bigint APIs remain unchanged.

Before submitting, call `await simulateSoloXTransaction({ simulateTransaction: tx => connection.simulateTransaction(tx) }, transaction)` with a caller-configured devnet or local validator connection and a prepared transaction. The adapter must simulate the supplied transaction, not send it. A `SoloXSimulationError` exposes `kind`, `detail` and `logs`; stop on failure. Simulation is advisory and does not guarantee execution; keep submission preflight enabled and confirm the result on chain. No wallet keys are handled by the SDK.

Run `npm run build -w @solo-x/sdk` followed by `npm run test -w @solo-x/sdk`.
