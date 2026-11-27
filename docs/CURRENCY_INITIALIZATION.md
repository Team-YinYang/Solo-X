# Currency initialization

`create_currency` creates the accounts required for one Solo-X currency. It is
available only on localnet or devnet during the MVP and is not production-ready.

## Accounts created

For every new issued mint, the program derives three independent addresses:

| Account | Derivation | Purpose |
| --- | --- | --- |
| Currency state | `[b"currency", issued_mint]` | Stores the verified currency configuration. |
| Authority | `[b"authority", currency_state]` | Sole mint authority and vault owner. |
| Collateral vault | `[b"vault", currency_state]` | Holds collateral for exactly one currency. |

The instruction initializes a standard SPL Token mint with exactly six decimals,
the authority PDA as its mint authority, no freeze authority, and zero supply.
It initializes a separate standard SPL Token account for the collateral vault,
owned by the authority PDA. The creator pays account rent and is recorded in
state, but does not receive token mint or vault-withdrawal authority.

## Test collateral allowlist

The MVP accepts only Solana devnet's test-USDC mint:
`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`.

For local-validator tests, Anchor clones that mint from devnet as configured in
`Anchor.toml`. Do not substitute an arbitrary mint or use real funds. A
governed collateral configuration is required before any production deployment.

## Verification

`tests/solo-x.ts` initializes two currencies against the configured test-USDC
mint and verifies that their state and vault PDAs differ. Run it with:

```bash
anchor test
```
