# Contributing

Claim an issue before editing. Branch from main, keep changes focused, add tests and documentation, and open a pull request with test results and linked issues. Obtain peer review before merging. Resolve conflicts and failing checks.

Never commit credentials, seed phrases or private keys. Use local validator or devnet only. Report security concerns privately to maintainers. Toolchain commands will follow scaffolding. License selection is pending team approval.

## Governance review

Changes to minting, collateral controls, upgrade authority, incident operations or
launch rules require explicit security and governance review. Follow
[production readiness](docs/PRODUCTION_READINESS.md); a green CI run is not a
mainnet launch approval. Never add a production deployment workflow without
independent approval and a separate verified release gate.
