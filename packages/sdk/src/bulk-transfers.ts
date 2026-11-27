import { parseSoloXAmount } from "./transactions.js";

export const MAX_BULK_TRANSFERS = 20;
export type TransferRow = Readonly<{ id: string; recipient: string; amount: bigint }>;
export type TransferStatus = "pending" | "unknown" | "confirmed" | "failed";
export type TransferResult = Readonly<{ row: TransferRow; status: TransferStatus; signature?: string; error?: string }>;
export interface BulkTransport {
  /** Prepare and sign without broadcasting. */
  prepare(row: TransferRow): Promise<{ signature: string; broadcast(): Promise<void> }>;
  /** Return failed only for definitive on-chain failure, never for timeout or missing status. */
  status(signature: string): Promise<"confirmed" | "failed" | "unknown">;
}
export function planBulkTransfers(rows: readonly TransferRow[]): TransferResult[] {
  if (!rows.length || rows.length > MAX_BULK_TRANSFERS) throw new Error("Batch must contain 1–20 transfers.");
  const ids = new Set<string>();
  return rows.map(row => {
    if (!row.id.trim() || ids.has(row.id)) throw new Error("Each transfer needs a unique ID.");
    ids.add(row.id);
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(row.recipient)) throw new Error("Invalid recipient address.");
    parseSoloXAmount(row.amount);
    return { row: Object.freeze({...row}), status: "pending" };
  });
}

/** Persist each state transition before broadcasting. A caller must use one durable,
 * exclusive journal per batch and restore it on restart; never recreate a retry plan. */
export async function executeBulkTransfers(
  journal: TransferResult[],
  transport: BulkTransport,
  persist: (snapshot: readonly TransferResult[]) => Promise<void>,
): Promise<void> {
  planBulkTransfers(journal.map(entry => entry.row));
  for (let i = 0; i < journal.length; i++) {
    const entry = journal[i];
    if (entry.status === "confirmed") continue;
    if (entry.status === "unknown") {
      if (!entry.signature) throw new Error("Missing signature in journal.");
      let status: "confirmed" | "failed" | "unknown";
      try { status = await transport.status(entry.signature); } catch { continue; }
      journal[i] = {...entry, status};
      await persist(journal.slice());
      continue;
    }
    let prepared: Awaited<ReturnType<BulkTransport["prepare"]>>;
    try { prepared = await transport.prepare(entry.row); }
    catch (error) {
      journal[i] = {...entry, status: "failed", error: String(error)};
      await persist(journal.slice());
      continue;
    }
    if (!prepared.signature) throw new Error("Missing signed transaction signature.");
    journal[i] = {row: entry.row, status: "unknown", signature: prepared.signature};
    await persist(journal.slice());
    try {
      await prepared.broadcast();
      const status = await transport.status(prepared.signature);
      journal[i] = {...journal[i], status};
    } catch (error) {
      journal[i] = {...journal[i], error: String(error)};
    }
    await persist(journal.slice());
  }
}
