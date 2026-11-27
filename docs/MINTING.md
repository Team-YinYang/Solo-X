# Collateral-backed minting

`mint_currency(amount)` accepts an amount in six-decimal base units. It performs
two standard SPL Token operations in one transaction:

1. Transfers `amount` of the configured test-USDC from the depositor's token
   account into that currency's derived collateral vault.
2. Uses the currency authority PDA to mint exactly `amount` of the issued token
   into the recipient's issued-token account.

The program rejects zero amounts, account substitutions, non-six-decimal mints,
an unapproved collateral mint, a depositor who does not own the source account,
and any pre-existing reserve deficit. The SPL Token program rejects insufficient
source balances. If either token CPI fails, the complete transaction rolls back.

The instruction keeps the reserve invariant intact: before minting, the vault
must cover supply; afterwards, vault balance and supply have both increased by
the same amount. This MVP only supports the configured devnet test-USDC mint.
Do not use real funds.

## Exact `mintCurrency` accounts

The depositor signs the instruction. Supply and vault balances are updated only
after the canonical relationships below are verified:

| Account | Requirement |
| --- | --- |
| `depositor` | Signing owner of `depositorCollateralTokens`. |
| `currency` | PDA `['currency', issuedMint]`. |
| `issuedMint` | Six-decimal currency mint, controlled by `authority`. |
| `collateralMint` | The currency's configured six-decimal test-USDC mint. |
| `depositorCollateralTokens` | Depositor-owned account for `collateralMint`. |
| `recipientIssuedTokens` | Token account for `issuedMint`; can belong to a recipient. |
| `collateralVault` | PDA `['vault', currency]`, owned by `authority`. |
| `authority` | PDA `['authority', currency]`; signs the mint CPI. |
| `tokenProgram` | Standard SPL Token program. |

`amount` must be a positive `u64` count of six-decimal base units. Wrong mints,
wrong vaults, unauthorized sources, reserve deficits, arithmetic overflow and
insufficient source balances fail without partial state changes.
