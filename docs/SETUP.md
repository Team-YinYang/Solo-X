# Local development setup

Solo-X uses a pinned Anchor workspace for its on-chain program. This foundation is
for local development and devnet only; never use real funds or a production wallet.

## Pinned toolchain

| Tool | Version |
|---|---|
| Rust | 1.75.0 |
| Solana CLI | 1.18.18 |
| Anchor CLI and TypeScript client | 0.30.1 |
| Node.js | 22.x LTS |

`Anchor.toml` and `rust-toolchain.toml` are the repository source of truth for
these versions. Keep the Anchor CLI and the `@coral-xyz/anchor` package on the
same version.

## Install prerequisites

Install Node.js 20 LTS, then install the Rust, Solana and Anchor toolchains:

```bash
rustup toolchain install 1.75.0
sh -c "$(curl -sSfL https://release.solana.com/v1.18.18/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --tag v0.30.1 --locked
avm install 0.30.1
avm use 0.30.1
```

Restart the shell after installing Solana so its bin directory is on `PATH`.
Confirm the versions before continuing:

```bash
rustc --version
solana --version
anchor --version
node --version
```

## Configure a local validator

Create a development keypair if you do not already have one, point the CLI to a
local validator, and fund the keypair:

```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url http://127.0.0.1:8899
solana-test-validator --reset --clone 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
# In a second terminal:
solana airdrop 10
```

The validator process must remain running while executing tests. `anchor test`
can also start and stop its own local validator when one is not already running.
It clones the approved devnet test-USDC mint configured in `Anchor.toml`.

## Build and smoke test

```bash
npm ci
anchor build
anchor test
```

The smoke test deploys the `solo_x` program to localnet, invokes its foundation
`initialize` instruction, and verifies that the transaction succeeds. It does
not create a currency or accept collateral.

## Devnet

Use a separately funded test wallet and explicit devnet configuration:

```bash
solana config set --url devnet
solana airdrop 2
```

Do not deploy or test against mainnet as part of this project foundation.
