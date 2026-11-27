import { MAX_U64, SoloXSdkError } from "./transactions.js";

/** Parse a positive six-decimal UI amount without floating-point arithmetic. */
export function parseSoloXDecimalAmount(value: string): bigint {
  if (typeof value !== "string" || value.length > 21 || !/^[0-9]+(?:\.[0-9]{1,6})?$/.test(value)) {
    throw new SoloXSdkError("INVALID_AMOUNT", "Enter a positive decimal amount with at most six fractional digits");
  }
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  if (units <= 0n || units > MAX_U64) throw new SoloXSdkError("INVALID_AMOUNT", "Amount is outside the positive u64 range");
  return units;
}

export interface SoloXSimulationResult {
  readonly err: unknown;
  readonly logs?: readonly string[] | null;
  readonly unitsConsumed?: number;
}
export interface SoloXSimulationClient<T> {
  simulateTransaction(transaction: T): Promise<{ readonly value: SoloXSimulationResult }>;
}
export class SoloXSimulationError extends Error {
  constructor(public readonly kind: "RPC_ERROR" | "TRANSACTION_ERROR", public readonly detail: unknown, public readonly logs: readonly string[] = []) {
    super(kind === "RPC_ERROR" ? "Transaction simulation RPC failed" : "Transaction simulation rejected", { cause: detail });
    this.name = "SoloXSimulationError";
  }
}

/** Simulate the exact transaction supplied by the caller; never signs or submits it. */
export async function simulateSoloXTransaction<T>(client: SoloXSimulationClient<T>, transaction: T): Promise<SoloXSimulationResult> {
  let result: SoloXSimulationResult;
  try {
    result = (await client.simulateTransaction(transaction)).value;
    if (!result || !Object.prototype.hasOwnProperty.call(result, "err") || result.err === undefined) throw new Error("Malformed simulation response");
  } catch (error) {
    throw new SoloXSimulationError("RPC_ERROR", error);
  }
  if (result.err !== null) throw new SoloXSimulationError("TRANSACTION_ERROR", result.err, result.logs ?? []);
  return result;
}
