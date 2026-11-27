export type HistoryEntry = { signature: string; slot: number; blockTime?: number | null; err: unknown };
export const PAGE_SIZE = 20;
export async function historyPage(fetchPage: (before?: string) => Promise<HistoryEntry[]>, before?: string) {
  const rows = await fetchPage(before);
  if (rows.length > PAGE_SIZE || rows.some(row => !row.signature) || new Set(rows.map(row=>row.signature)).size !== rows.length || rows.some(row=>row.signature===before)) throw new Error("Invalid RPC history page.");
  return { rows, next: rows.length === PAGE_SIZE ? rows[rows.length-1].signature : undefined };
}
export function reconcile(supply: bigint, reserves: bigint) {
  if(supply<0n || reserves<0n) throw new Error("Invalid reserve amounts.");
  return { surplus: reserves>supply?reserves-supply:0n, deficit:supply>reserves?supply-reserves:0n, covered:reserves>=supply };
}
