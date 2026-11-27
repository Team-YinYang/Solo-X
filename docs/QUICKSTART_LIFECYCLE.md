# Reproducible local and devnet lifecycle

Use Node 22, Rust 1.75, Solana 1.18.18 and Anchor 0.30.1. No private credentials are needed: create a local development keypair and use only test funds.

```bash
npm ci
solana config set --url http://127.0.0.1:8899
solana-test-validator --reset --clone 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
# second terminal
solana airdrop 10
anchor build
anchor test
npm run lint
npm run typecheck
npm run build
npm run test
```

For devnet, use an isolated wallet and `.env.local` with `NEXT_PUBLIC_SOLANA_NETWORK=devnet` and the public devnet RPC URL. Never add seeds, private keys, or API credentials to files.

## Two-user lifecycle scenario

Create two backed currencies (issuer A and issuer B). Fund two holder token accounts with test collateral, mint equal base units to both holders, transfer a portion between holders, convert one holder's source currency into the compatible destination currency, then redeem remaining tokens. After every operation, read the issued mint supply and each canonical vault: every vault must satisfy `reserve >= supply`; transfers leave reserve/supply unchanged; conversion preserves total collateral; redemption decreases reserve and supply equally. Run this on local validator or devnet only.
