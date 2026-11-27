# Continuous integration

Pull requests and pushes to `main` run `.github/workflows/ci.yml`. The workflow is intentionally compatible with the current documentation-only repository. It does **not** claim Rust or TypeScript builds passed while those sources are absent; GitHub displays a notice for each missing project. A separate CI configuration smoke test always runs.

## When scaffolding lands

- **Rust / Anchor (issue #1):** commit a root `Cargo.toml` and `Cargo.lock`. CI enables `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, `cargo build --workspace --locked`, and `cargo test --workspace --locked`. Use locked compatible Rust dependencies. Solana validator integration tests should be added as a follow-up when the Anchor workspace is available; this job only executes cargo workspace tests.
- **Next.js / TypeScript / SDK (issue #2):** commit a root `package.json` defining npm workspaces, `package-lock.json`, `.nvmrc` containing a supported Node version, and package manifests under e.g. `apps/web` and `packages/sdk`. Each workspace must expose `lint`, `typecheck`, `build`, and `test` npm scripts. CI validates these expectations first, runs `npm ci`, then executes those four scripts in all workspaces. Nonexistent scripts fail validation rather than being skipped. Use non-interactive test commands.

## Branch protection

A repository admin must configure **Settings > Branches > Add branch protection rule** (or a repository ruleset) for `main`, enable *Require status checks to pass before merging* and select these checks after the workflow's first successful run:

- `CI configuration smoke test`
- `Rust / Anchor`
- `TypeScript / Workspace`

Until this rule is configured, failed checks do not necessarily prevent a merge. Note also that the Rust and TypeScript jobs succeed with a visible notice when their workspaces are absent; this is deliberate to allow issue #3 to land independently of #1 and #2. Revisit this behavior once both scaffolds merge.

## Local verification

Run `node --test .github/scripts/check-ts-workspace.test.cjs` with Node 22+. Once code is scaffolded, run the corresponding cargo and npm commands above. No credentials, wallet keys or devnet deployment are required by CI.
