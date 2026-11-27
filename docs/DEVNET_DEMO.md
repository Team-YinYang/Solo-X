# Devnet demo rehearsal

Solo-X supports **local validator and Solana devnet test collateral only**. This runbook deliberately excludes mainnet, production wallets, private keys and real funds. A successful rehearsal produces two distinct backed currencies, shows a holder transfer and atomic conversion, then redeems the remaining issued tokens while checking reserves after each transaction.

## Prerequisites

- Node 22, Rust 1.75, Solana CLI 1.18.18 and Anchor 0.30.1.
- A new, isolated devnet wallet funded only with devnet SOL.
- Test USDC for `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, in two six-decimal token accounts controlled by the demo wallet(s).
- A deployed Solo-X program whose address is recorded below. Confirm it before running any transactions: `solana program show <PROGRAM_ID> --url devnet`.

## Build and deploy the reviewed program

Run this from a clean, reviewed commit. The deploy wallet must be an authorized upgrade authority and must never be committed or pasted into the web app.

```bash
npm ci
anchor build
cargo test --workspace --locked
npm run lint
npm run typecheck
npm run build
npm run test
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

Record the program address and deployment transaction signature in the evidence table. Do not substitute an address from a different build, cluster or commit.

## Rehearsal: two currencies, transfer, conversion and redemption

Open the deployed web app with `NEXT_PUBLIC_SOLANA_NETWORK=devnet` and a public devnet RPC URL. Connect the isolated test wallet, then use the transaction review dialog before each wallet approval.

1. Create Currency A and Currency B, both using the configured test-USDC mint. Record each issued mint, currency-state PDA and collateral-vault PDA.
2. Mint `10.000000` units of A to holder 1 and `10.000000` units of B to holder 1, depositing exactly equal test USDC into each vault.
3. Transfer `3.000000` A from holder 1 to an initialized A token account for holder 2. Confirm A's supply and vault balance did not change.
4. Convert `2.000000` A from holder 1 to B. Confirm both canonical vaults and mint supplies in the reserve dashboard; each must satisfy `reserve >= supply`, and the combined test-USDC reserve must be unchanged.
5. Redeem every remaining A and B token held by both holders. Confirm each redeemed amount decreases that currency's supply and vault balance by the same base-unit amount. Final supplies should be zero; any remaining reserve is an explicit excess reserve, never a claimable balance.

For every transaction, save the explorer URL, inspect the program ID and token account addresses, and wait for confirmed status before continuing. A failed transaction must leave token balances unchanged; do not retry an ambiguous wallet submission with a newly signed transaction.

## Evidence record

Complete this table for each public devnet rehearsal. It is intentionally blank until a real deployment is verified; never invent deployment addresses or CI results.

| Field | Verified value |
| --- | --- |
| Git commit | _pending_ |
| CI run URL and result | _pending_ |
| Cluster | `devnet` |
| Program ID | _pending_ |
| Program deployment signature | _pending_ |
| Test-USDC mint | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| Currency A: issued mint / state / vault | _pending_ |
| Currency B: issued mint / state / vault | _pending_ |
| Mint, transfer, conversion and redemption signatures | _pending_ |
| Final reserve/supply checks | _pending_ |

## Local-validator CI rehearsal

The automated Anchor suite is the local-validator counterpart to the manual devnet rehearsal. Run `anchor test` with the validator setup in [`QUICKSTART_LIFECYCLE.md`](QUICKSTART_LIFECYCLE.md), then record the passing CI run against the same commit in the evidence table before presenting the demo.
