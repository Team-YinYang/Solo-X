# Currency state and account constraints — issue #4

This documents the **MVP interface**, not a deployed or audited program. The Rust implementation lives in `programs/solo_x/src/state.rs`. The Anchor workspace and currency initialization instruction are implemented; minting, redemption, and conversion remain separate issues. Use local validator or devnet test tokens only.

## PDA derivations

All PDAs are derived with the deployed **Solo-X program ID** (not the SPL Token program ID).

| Account | Seeds | Stored bump |
| --- | --- | --- |
| Currency state | `[b"currency", issued_mint]` | `state_bump` |
| Collateral vault | `[b"vault", currency_state]` | `vault_bump` |
| Currency mint/vault authority | `[b"authority", currency_state]` | `authority_bump` |

`issued_mint` is a distinct, six-decimal standard SPL Token mint for each new Solo-X currency. The vault is a **dedicated SPL Token account address PDA per currency** (not a shared associated token account); its token-account `owner` is the per-currency authority PDA. Different currencies may use the same USDC collateral mint but **must not share a vault**. The creator has no token authority by virtue of being recorded in the state.

## State layout

`CurrencyState` uses an 8-byte Anchor discriminator and fixed-length fields:

| Field | Type | Bytes | Meaning |
| --- | --- | ---: | --- |
| `version` | `u8` | 1 | Current layout version 1 |
| `creator` | `Pubkey` | 32 | Informational issuer identity |
| `issued_mint` | `Pubkey` | 32 | Six-decimal currency mint |
| `collateral_mint` | `Pubkey` | 32 | Configured test-USDC mint |
| `collateral_vault` | `Pubkey` | 32 | Isolated collateral account |
| `authority` | `Pubkey` | 32 | PDA for mint authority and token vault owner |
| `state_bump` | `u8` | 1 | Currency PDA bump |
| `vault_bump` | `u8` | 1 | Vault PDA bump |
| `authority_bump` | `u8` | 1 | Authority PDA bump |

**Allocate `8 + CurrencyState::INIT_SPACE` = 172 bytes.** The state does not record collateral balances or mint supply; later instructions must read the actual SPL vault balance and mint supply. Donations or direct token burns may create excess reserves.

## Validation rules

- `Account<CurrencyState>` enforces program ownership. State address, mint binding, version, stored bumps and PDA derivations must match this program.
- `Account<Mint>`, `Account<TokenAccount>` and `Program<Token>` enforce the **standard SPL Token v1** account/program types; foreign token programs, arbitrary accounts and Token-2022 accounts are rejected.
- Issued and collateral mints must differ and use **exactly six decimals**. The currency mint authority must be the currency authority PDA, and its freeze authority must be absent.
- The vault must have the exact derived PDA address, the configured collateral mint, the matching currency authority as token owner, **no delegate** and **no close authority**.
- The initializer in issue #5 must check the collateral mint against a trusted configured **test-USDC allowlist** before storing it. Checking that an account matches the value already stored in `CurrencyState` is **not** an allowlist; this module does not implement one.
- Future mint/redeem/convert instructions must reuse these checks, check user authority and reserve invariants, use checked arithmetic, reject zero-value operations, and execute token changes atomically. No mint, withdrawal, or collateral transfer instruction is added by this issue.

## Errors and test coverage

`CurrencyError` covers invalid state/version, issued mint, collateral mint, vault, authority, bump, decimals, freeze authority, token vault owner, delegate, and close authority.

Seven Rust unit tests are included for valid derivations and rejection of **cross-currency vault substitution**, **issued mint substitution**, **wrong program ID**, **authority substitution**, **wrong bump/version**, and **identical issued/collateral mints**. Anchor account constraints additionally cover actual account ownership and program validation; they require validator-based integration tests once issues #1 and #5 land.

## Integration steps

1. `create_currency` (#5) allocates `8 + CurrencyState::INIT_SPACE` and populates all fields from verified accounts, never caller-provided bumps.
2. Reuse `ValidateCurrency` in later instruction contexts and call `.validate(ctx.program_id)?` after Anchor's account constraints, before CPI token operations.
3. Run `cargo test` and `anchor test` on the initialized workspace and add local-validator tests covering foreign-owned state/mints, wrong SPL Token program, vault delegation and account substitutions.

**Verification status:** The repository now includes a Cargo/Anchor workspace and a two-currency local-validator integration test. No successful local-validator run is claimed until the pinned Solana and Anchor toolchain is installed and `anchor test` completes. Code must pass those checks before deployment or use with assets.
