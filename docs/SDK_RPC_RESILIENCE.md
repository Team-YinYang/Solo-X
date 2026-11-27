# SDK RPC resilience and confirmation strategy (Issue #32)

The `@solo-x/sdk` package exports `readSoloXRpcWithRetry`, `reconcileSoloXConfirmation`, and `SoloXSubmissionTracker`. These utilities do not sign transactions, hold private keys, or select mainnet endpoints. Only devnet or a local validator is in scope.

## Reads: bounded retries and freshness

Wrap **idempotent read operations only**:

```ts
const reserves = await readSoloXRpcWithRetry(
  async () => ({ value: await connection.getAccountInfo(currency), observedAt: Date.now() }),
  { maxAttempts: 3, initialDelayMs: 200, maxDelayMs: 1000, maxAgeMs: 30_000 },
);
if (reserves.stale) showRefreshWarning();
```

Recognized transient failures include 408, 429, 500/502/503/504, Solana -32005 and common network timeout/reset codes. Non-transient errors fail immediately. Backoff doubles from the configured initial delay and is capped; attempt count is strictly bounded at six. Invalid RPC payloads and timestamps fail closed. A supplied observation timestamp permits stale data to be flagged; without one, freshness starts when the response completes. Freshness metadata is not a guarantee of chain finality.

## Writes: one broadcast per signature

1. Build/sign with the user's wallet and obtain the **expected base58 signature from the signed message**.
2. Call `tracker.submitOnce(rpc, expectedSignature, signedTransactionBytes)`. It broadcasts at most once for that signature per tracker instance, with preflight enabled and RPC-level automatic resend disabled.
3. Treat a network exception, unexpected returned signature, or lost response as `unknown`. The transaction **may have landed**, so do not send another transaction.
4. Call `tracker.reconcile(rpc, expectedSignature, lastValidBlockHeight)` to query historical signature status and then block height. States: `submitted`, `processed`, `confirmed`, `finalized`, `failed`, `expired`, `unknown`.
5. A **freshly reviewed and newly signed** attempt is eligible only after explicit on-chain failure, or after the blockhash has expired and the signature was not found in available RPC history. Inspect independent history if there are concerns about RPC retention.
6. The tracker is **in-memory**; persist unresolved signatures separately if the application needs recovery across refresh/restart. Never interpret process restart as permission to retry.

The SDK deliberately does not automatically invoke another `sendRawTransaction` during status reconciliation.

## Tests

```bash
npm ci
npm run lint --workspaces --if-present
npm run typecheck --workspaces --if-present
npm run build --workspaces --if-present
npm run test --workspaces --if-present
```

Coverage includes rate limiting, outages, exponential delay cap, stale reads, non-transient failures, malformed responses, observed confirmation states, uncertain history and duplicate-submission prevention. Live RPC/wallet integration on a funded devnet/local validator remains a separate manual exercise.
