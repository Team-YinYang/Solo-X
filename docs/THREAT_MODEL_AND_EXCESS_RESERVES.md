# Threat model and excess-reserve accounting

Solo-X trusts the Solana runtime, standard SPL Token program, configured test-USDC issuer, RPC endpoint used for reads, and the program upgrade authority. A malicious creator cannot mint or withdraw reserves because each currency uses a PDA authority; tests cover substituted mints, vaults, authorities, bumps, token ownership, and atomic rollback. Residual risks include upgrade-key compromise, issuer freeze/depeg risk, malicious RPC presentation, validator availability, and unaudited program logic.

Unsolicited SPL deposits create **excess reserves**: `reserve > supply`. They are intentionally not withdrawable by any arbitrary account and remain with the currency. Direct SPL burns reduce supply without withdrawing collateral, also creating excess reserves. Both cases preserve `reserve >= supply`; neither changes the one-to-one mint/redeem amount. At zero supply, all remaining collateral is excess and still has no arbitrary withdrawal path. Six-decimal base units avoid rounding in the MVP.

Ordinary SPL tokens are a separate feature. They create no Solo-X state, collateral vault, redemption right, or conversion route.
