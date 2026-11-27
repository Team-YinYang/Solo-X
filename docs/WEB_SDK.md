# Web and SDK workspace (issue #2)

Solo-X uses npm workspaces for a Next.js/TypeScript application and non-custodial SDK. Dependencies are pinned, and Node 22 is selected in `.nvmrc`.

## Getting started

Install Node 22 and npm 10, then run:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The landing page links to the workspace preview at `/workspace`; no wallet or live protocol transactions are wired in yet. `.env.example` contains **public** devnet defaults, never credentials. For localnet use `NEXT_PUBLIC_SOLANA_NETWORK=localnet` and `NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899` in your ignored `.env.local`.

## Quality gates

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

The root commands check both workspaces and build the SDK before its runtime tests. CI issue #3 uses `npm ci` and invokes scripts in each workspace.

## SDK

```ts
import { createSoloXRpcConfig } from "@solo-x/sdk";

const { endpoint, commitment } = createSoloXRpcConfig("devnet");
```

The current SDK offers type-safe localnet/devnet RPC configuration only. It does not connect wallets, build protocol transactions, hold keys or support mainnet. Those features are reserved for subsequent issues following `ARCHITECTURE.md`.

The workspace package directories are `apps/web` and `packages/sdk`. Install from the repository root so npm links the SDK workspace correctly.

**Security:** This is an unaudited foundation preview. Use a local validator or devnet only; never deposit real funds.
