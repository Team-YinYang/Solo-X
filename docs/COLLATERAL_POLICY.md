# Immutable MVP collateral policy

Solo-X accepts only devnet test-USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`, six decimals, and the canonical legacy SPL Token program (`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`). This is test collateral, not production USDC. Local validators clone the devnet mint. No mainnet use is authorized.

Creation, minting, redemption, conversion and shared account validation enforce the same policy. Stored currency state must also match the canonical mint, even when all PDAs are valid. Anchor typed accounts enforce ownership and token program identity. No creator or administrator instruction can change the policy or stored collateral. The policy is immutable within this program version, not across program upgrades; upgrade authority remains a separate governance risk. No account layout changes are required.

Run `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings -A unexpected_cfgs`, `cargo test --workspace --locked` and `anchor test`. Regression tests cover wrong mint, decimals, token program and mutated stored collateral. Validator tests must confirm rejection and rollback before release.
