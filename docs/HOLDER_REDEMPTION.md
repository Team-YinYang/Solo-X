# Holder redemption (issue #7)

`redeem_currency(amount: u64)` swaps a holder's issued SPL tokens for an equal number of six-decimal test-USDC base units. The holder signs, burns exactly `amount` units from their own currency token account, and receives exactly `amount` units in a collateral token account **they own**. The transfer is signed by the currency-specific authority PDA. The creator has no special redemption permission.

## Required accounts

- `holder`: the redeeming token owner and transaction signer (not necessarily the currency creator)
- `currency`: the account derived from `[b"currency", issued_mint]`
- `issued_mint`: the configured six-decimal SPL currency mint (writable for burn)
- `collateral_mint`: the matching six-decimal allowed collateral mint
- `holder_issued_tokens`: writable SPL account owned by the signer, holding the issued mint
- `holder_collateral_tokens`: writable SPL account owned by the signer, holding the collateral mint
- `collateral_vault`: the currency's isolated collateral token PDA
- `authority`: PDA derived from `[b"authority", currency]`
- `token_program`: standard SPL Token program, not Token-2022

The instruction validates stored state and PDA bumps, issued-mint authority and freeze settings, exact token-account mints/owners, vault delegation/close authority, token program identity, nonzero amount and both balances. It refuses to run if the vault has less collateral than circulating supply, even if the requested redemption amount would fit.

## Atomicity and tests

The SPL burn and vault withdrawal execute in the *same instruction and transaction*. If the withdrawal CPI fails, Solana rolls back the earlier burn; tokens cannot be destroyed without the collateral payout succeeding.

Rust unit tests cover positive amounts, zero-value requests, insufficient holder balance, insufficient supply, insufficient vault balance, undercollateralization and boundary values. In addition, the Anchor account constraints reject missing/wrong holder signatures, substituted currency mints/vaults, and payout accounts that are not owned by the holder.

**End-to-end validator test dependency:** issuance in issue #6 is not present on `main` at the time of this PR. Once it lands, add validator tests that mint collateral-backed issued tokens, redeem with a holder distinct from the creator, assert supply and reserve decreases, and confirm unchanged balances after an intentionally failing transaction. Do not claim successful full redemption testing until that flow is exercised.

```bash
RUSTUP_TOOLCHAIN=stable cargo fmt --all -- --check
RUSTUP_TOOLCHAIN=stable cargo clippy --workspace --all-targets --locked -- -D warnings -A unexpected_cfgs
RUSTUP_TOOLCHAIN=stable cargo test --workspace --locked
# Once #6 is merged and a validator is available:
anchor test
```

Only use local validator or devnet test-USDC. This protocol has not been audited; never use real funds.
