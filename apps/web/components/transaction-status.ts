import type { BlockhashWithExpiryBlockHeight, Connection } from "@solana/web3.js";

export type Reconciliation = "confirmed" | "failed" | "expired" | "pending";

/** Fail closed on RPC errors, unavailable history, or still-live blockhashes. */
export async function reconcileTransaction(
  connection: Pick<Connection, "getSignatureStatuses" | "getBlockHeight">,
  signature: string,
  block: BlockhashWithExpiryBlockHeight,
): Promise<Reconciliation> {
  const result = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
  const status = result.value[0];
  if (status?.err) return "failed";
  if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return "confirmed";
  // A status seen on-chain but not confirmed must not be retried, even after expiry.
  if (status) return "pending";
  const height = await connection.getBlockHeight("confirmed");
  return height > block.lastValidBlockHeight ? "expired" : "pending";
}

/** Compute the signature from signed bytes before broadcasting: an RPC send error can be ambiguous. */
export function signedSignature(bytes: Uint8Array): string {
  if (bytes.length !== 64 || bytes.every((byte) => byte === 0)) throw new Error("Transaction was not signed.");
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading++;
  let number = 0n;
  for (const byte of bytes) number = (number << 8n) + BigInt(byte);
  let encoded = "";
  while (number > 0n) {
    const index = Number(number % 58n);
    encoded = alphabet[index] + encoded;
    number /= 58n;
  }
  return "1".repeat(leading) + encoded;
}
