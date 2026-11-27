# Seeded accounting properties

The Rust security suite runs five fixed xorshift seeds, 4,096 operations each, across three isolated currencies and a bounded collateral wallet. It exercises production mint, redemption and conversion arithmetic guards, with a modeled donation and token balance transition. Each step checks acceptance against an independent bounded oracle, exact per-currency balances, solvency, global collateral conservation and unchanged balances on rejection. Zero and maximum u64 inputs are generated; existing overflow regressions cover maximum supply and reserve balances.

Run `cargo test --workspace --locked seeded_accounting_sequences_preserve_invariants -- --nocapture`. Failure messages identify seed and step; replay by retaining that seed in the array. The test requires no network or new dependency. It is not a validator or SPL CPI rollback test; run `anchor test` separately on localnet. No production funds.
