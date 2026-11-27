# Atomic currency conversion

`convert_currency(amount: u64)` exchanges equal six-decimal base units between distinct Solo-X currencies backed by the configured test-USDC mint. The holder signs and owns both token accounts. The program validates canonical state, mint, vault and authority bindings, standard SPL Token ownership, collateral compatibility and pre-operation solvency. It burns source tokens, transfers collateral using the source PDA, and mints destination tokens using the destination PDA. All CPIs execute in one instruction; any error rolls back the transaction. Both reserves are reloaded and checked against supply afterward. Excess reserves are preserved.

## Verification

Run `cargo fmt --all`, `cargo test --workspace --locked`, and `anchor test`. Unit tests cover amount, balance, insolvency and overflow checks. Validator integration must cover successful conversion, identical currencies, incompatible collateral, substituted vaults, incorrect signer, frozen accounts and rollback after failed CPI. Verify both supplies and vault balances before and after each case. Fund test currencies through the mint instruction when available. No production assets or deployment.

Unit and validator tests have not been executed by this contribution environment.
