# Conversion, transfers, and reserve reads

The workspace is limited to devnet and local-validator RPC endpoints. Connect a test wallet, enter an issued mint, and use **Convert** only between verified Solo-X currencies. Both sides must use the configured test collateral; the on-chain instruction rejects incompatible, duplicate, or substituted accounts atomically.

**Transfer** is a standard SPL Token transfer. The destination is the recipient's existing issued-token account, not their wallet address.

The reserve dashboard reads the issued mint supply and canonical collateral-vault balance directly from RPC. It shows a reserve ratio and explorer links. Treat the value as stale after it is displayed: refresh before making a decision. Do not use real funds.
