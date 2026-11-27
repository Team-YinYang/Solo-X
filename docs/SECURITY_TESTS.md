# Security tests and reserve invariants — issue #15

## Threat model and coverage

Solo-X creates a new SPL mint, a currency state PDA, and an isolated collateral
vault for each currency. The only authorized mint/vault authority is the
currency-specific PDA, never the human creator.

| Attack or risk | Test and expected outcome |
| --- | --- |
| Wrong issued mint, cross-currency vault or authority | Rust address-binding tests reject substituted PDAs; validator tests reject alternate vault/authority |
| Incorrect PDA bumps / state version / wrong program | Rust tests reject all mutations |
| Unauthorized SPL mint | Validator test attempts a direct `MintTo` signed by a wallet, verifies it fails and mint state is unchanged |
| Wrong collateral mint | Validator test tries the system program as collateral, verifies no accounts are created |
| Transaction rollback | Validator test executes two creates in one transaction: the second fails, and the first must also be rolled back |
| Over-minting, burning, undercollateralized starting state, conversion overflows | Exhaustive bounded Rust oracle tests reject failing transitions and verify they are no-ops |
| Reserve isolation and invariant | Rust tests verify unique PDAs and `reserve >= supply` after each accepted model mint, redeem, or conversion, with excess collateral preserved |

## Commands

Run fast tests on every PR:

```bash
RUSTUP_TOOLCHAIN=stable cargo fmt --all -- --check
RUSTUP_TOOLCHAIN=stable cargo clippy --workspace --all-targets --locked -- -D warnings -A unexpected_cfgs
RUSTUP_TOOLCHAIN=stable cargo test --workspace --locked
npm ci
npm run lint --workspaces
npm run typecheck --workspaces
npm run build --workspaces
npm run test --workspaces
```

For on-chain security regression tests, install the pinned Anchor/Solana toolchain
listed in `Anchor.toml`, provide a funded *local* validator wallet, and use
the devnet test-USDC mint clone specified in `Anchor.toml`. Then run:

```bash
anchor test
```

These TypeScript tests are deliberately **not** included in the Node workspace
unit suite: they require a running Solana validator, the program build/deploy,
and the cloned devnet collateral mint.

## Known risks and remaining work

See [threat model and excess-reserve accounting](THREAT_MODEL_AND_EXCESS_RESERVES.md) for the explicit trust boundaries, unsolicited deposits, direct burns, zero-supply treatment, and residual risks.

- `main` now contains `mint_currency`, but successful mint → redemption →
  conversion scenarios require an initialized, funded holder account for
  the devnet test-USDC collateral mint. The cloned devnet mint does not
  automatically provide spendable balances to the local validator wallet.
- The bounded Rust arithmetic oracle is a regression model, **not** a proof of
  transaction-level SPL-token safety. Only validator tests verify RPC account
  ownership, PDA signatures, and Solana rollback.
- The validator rollback test confirms atomic rollback across two `create_currency`
  instructions. A post-burn failed transfer and a post-collateral-transfer failed
  mint should be added after provisioning funded test-USDC fixtures.
- Upgrade authority, RPC trust, collateral issuer restrictions, frozen accounts,
  and audit readiness remain outside the assurance of this test suite.
- This MVP uses devnet test-USDC and is unaudited. Do not use production funds.

After issue #6's mint instruction is implemented, extend the local-validator
tests to assert real SPL mint supply and vault reserves for *every* successful
mint, redeem, and convert, including cross-currency reserve isolation.
