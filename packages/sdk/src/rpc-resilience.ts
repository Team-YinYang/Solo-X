/** Dependency-free RPC resilience for Solo-X devnet/localnet integrations.
 * Read retries are bounded; signed transactions are never automatically rebroadcast.
 */
export type SoloXConfirmationState = "submitted" | "processed" | "confirmed" | "finalized" | "failed" | "expired" | "unknown";

export interface SoloXReadOptions {
  /** Maximum attempts INCLUDING the initial read (1-6). Defaults to 3. */
  readonly maxAttempts?: number;
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  /** 0 rejects any previously observed response; defaults to 30 seconds. */
  readonly maxAgeMs?: number;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}
export interface SoloXReadResult<T> {
  readonly value: T;
  /** Origin timestamp if provided, otherwise the instant at which the read finished. */
  readonly observedAt: number;
  readonly ageMs: number;
  readonly stale: boolean;
  readonly attempts: number;
}
export class SoloXRpcReadError extends Error {
  constructor(public readonly attempts: number, cause: unknown) {
    super("Solo-X RPC read failed after " + attempts + " attempt(s)", { cause });
    this.name = "SoloXRpcReadError";
  }
}
const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
function validInteger(value: number, min: number, max: number, name: string) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError("Invalid " + name);
}

/** Retry only recognized transient transport/rate-limit/server errors. Unknown errors fail closed. */
export function isTransientSoloXRpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { status?: unknown; statusCode?: unknown; code?: unknown; message?: unknown };
  const status = record.status ?? record.statusCode;
  if (typeof status === "number") return [408, 429, 500, 502, 503, 504].includes(status);
  if (typeof record.code === "number") return record.code === -32005;
  if (typeof record.code === "string" && ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "ENETUNREACH", "UND_ERR_CONNECT_TIMEOUT"].includes(record.code)) return true;
  // Some web3 RPC wrappers only expose a message for transport errors.
  return typeof record.message === "string" && /\b(429|rate limit|too many requests|timed out|timeout|503|502|504|service unavailable|connection reset|fetch failed)\b/i.test(record.message);
}

/** Returns the read plus explicit freshness metadata. Never retries an application error. */
export async function readSoloXRpcWithRetry<T>(
  read: () => Promise<{ readonly value: T; readonly observedAt?: number }>,
  options: SoloXReadOptions = {},
): Promise<SoloXReadResult<T>> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 200;
  const maxDelayMs = options.maxDelayMs ?? 1000;
  const maxAgeMs = options.maxAgeMs ?? 30_000;
  validInteger(maxAttempts, 1, 6, "maxAttempts");
  validInteger(initialDelayMs, 0, 60_000, "initialDelayMs");
  validInteger(maxDelayMs, initialDelayMs, 60_000, "maxDelayMs");
  validInteger(maxAgeMs, 0, 86_400_000, "maxAgeMs");
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await read();
      if (!result || !Object.prototype.hasOwnProperty.call(result, "value")) throw new Error("Invalid RPC read response");
      const finishedAt = now();
      const observedAt = result.observedAt ?? finishedAt;
      if (!Number.isFinite(finishedAt) || !Number.isFinite(observedAt) || observedAt > finishedAt) throw new Error("Invalid RPC observation timestamp");
      const ageMs = finishedAt - observedAt;
      return Object.freeze({ value: result.value, observedAt, ageMs, stale: ageMs > maxAgeMs, attempts: attempt });
    } catch (error) {
      if (!isTransientSoloXRpcError(error) || attempt === maxAttempts) throw new SoloXRpcReadError(attempt, error);
      const backoff = Math.min(maxDelayMs, initialDelayMs * 2 ** (attempt - 1));
      await sleep(backoff);
    }
  }
  throw new Error("Unreachable RPC retry state");
}

export interface SoloXSignatureStatus {
  readonly err: unknown;
  readonly confirmationStatus?: "processed" | "confirmed" | "finalized" | null;
}
export interface SoloXConfirmationClient {
  getSignatureStatuses(signatures: readonly string[], options: { readonly searchTransactionHistory: true }): Promise<{ readonly value: readonly (SoloXSignatureStatus | null)[] }>;
  getBlockHeight(commitment: "confirmed"): Promise<number>;
}
export interface SoloXConfirmationResult {
  readonly signature: string;
  readonly state: SoloXConfirmationState;
  /** Only proven on-chain failure or absent signature after blockhash expiry allows manual new-signature retry. */
  readonly canReviewNewAttempt: boolean;
}
function result(signature: string, state: SoloXConfirmationState, canReviewNewAttempt = false): SoloXConfirmationResult {
  return Object.freeze({ signature, state, canReviewNewAttempt });
}

/** Reads canonical history first. Status or RPC uncertainty always blocks manual resubmission. */
export async function reconcileSoloXConfirmation(
  rpc: SoloXConfirmationClient, signature: string, lastValidBlockHeight: number,
): Promise<SoloXConfirmationResult> {
  if (!signature || !Number.isSafeInteger(lastValidBlockHeight) || lastValidBlockHeight < 0) throw new Error("Invalid signature or expiry height");
  try {
    const reply = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true });
    if (!reply || !Array.isArray(reply.value) || reply.value.length !== 1) return result(signature, "unknown");
    const status = reply.value[0];
    if (status) {
      if (status.err) return result(signature, "failed", true);
      if (status.err !== null) return result(signature, "unknown");
      if (status.confirmationStatus === "finalized") return result(signature, "finalized");
      if (status.confirmationStatus === "confirmed") return result(signature, "confirmed");
      return result(signature, "processed");
    }
    const height = await rpc.getBlockHeight("confirmed");
    if (!Number.isSafeInteger(height) || height < 0) return result(signature, "unknown");
    return height > lastValidBlockHeight ? result(signature, "expired", true) : result(signature, "submitted");
  } catch {
    return result(signature, "unknown");
  }
}

export interface SoloXSignedSubmissionClient extends SoloXConfirmationClient {
  sendRawTransaction(signedBytes: Uint8Array, options: { readonly skipPreflight: false; readonly maxRetries: 0 }): Promise<string>;
}

/** Sign separately in the caller's wallet. Caller must provide the exact signature BEFORE first broadcast. */
export class SoloXSubmissionTracker {
  private readonly attempts = new Map<string, SoloXConfirmationResult>();
  private readonly inFlight = new Map<string, Promise<SoloXConfirmationResult>>();

  /** Broadcast each signature at most once per tracker instance, even under concurrent calls. */
  submitOnce(rpc: SoloXSignedSubmissionClient, signature: string, signedBytes: Uint8Array): Promise<SoloXConfirmationResult> {
    if (!signature || signedBytes.length === 0) throw new Error("Signed bytes and expected signature required");
    const existing = this.inFlight.get(signature);
    if (existing) return existing;
    const previous = this.attempts.get(signature);
    if (previous) return Promise.resolve(previous);
    // Lock before issuing the RPC call. Sending may succeed even if the response is lost.
    this.attempts.set(signature, result(signature, "unknown"));
    const attempt = (async () => {
      try {
        const returned = await rpc.sendRawTransaction(signedBytes, { skipPreflight: false, maxRetries: 0 });
        const status = returned === signature ? result(signature, "submitted") : result(signature, "unknown");
        this.attempts.set(signature, status);
        return status;
      } catch {
        // Never infer non-submission from a transport failure.
        return result(signature, "unknown");
      } finally { this.inFlight.delete(signature); }
    })();
    this.inFlight.set(signature, attempt);
    return attempt;
  }

  async reconcile(rpc: SoloXConfirmationClient, signature: string, lastValidBlockHeight: number): Promise<SoloXConfirmationResult> {
    if (!this.attempts.has(signature)) throw new Error("Unknown submission: cannot reconcile");
    const inFlight = this.inFlight.get(signature);
    if (inFlight) await inFlight;
    const status = await reconcileSoloXConfirmation(rpc, signature, lastValidBlockHeight);
    this.attempts.set(signature, status);
    return status;
  }
}
