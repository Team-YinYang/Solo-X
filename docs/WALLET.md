# Wallet connection

The workspace connects to a Phantom-compatible browser wallet for **devnet** or a local validator only. It uses the public `NEXT_PUBLIC_SOLANA_NETWORK` and `NEXT_PUBLIC_SOLANA_RPC_URL` settings from `.env.local`; never put a seed phrase, private key or API secret in these variables.

On load, the workspace calls `getGenesisHash` against the configured RPC endpoint. Devnet must return the devnet genesis hash. Any network other than `devnet` or `localnet`, including mainnet, is blocked before a wallet can connect. A local validator is accepted after its RPC endpoint responds.

The **Verify signature** action signs the fixed text `Solo-X devnet wallet verification`. It is a wallet-ownership check only: it does not create, submit or pay for a transaction. Connection and signature cancellation are displayed in the interface and leave no transaction behind.

Wallet-provider APIs do not reliably report the cluster selected inside every wallet extension. Before future transaction flows are enabled, Solo-X must also validate every transaction's RPC connection and program IDs against the selected devnet or local-validator configuration.

Use an isolated test wallet with test funds. Do not use a production wallet or real funds.
