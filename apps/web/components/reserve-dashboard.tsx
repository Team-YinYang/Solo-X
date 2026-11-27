"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { formatAmount } from "./amount";
import { verifiedConnection } from "./currency-transactions";

const PROGRAM = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
type Snapshot = { supply: bigint; reserves: bigint; updated: Date; mint: string; vault: string };

export function ReserveDashboard() {
  const [mint, setMint] = useState(""); const [snapshot, setSnapshot] = useState<Snapshot | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true); setMessage("");
    try {
      const issued = new PublicKey(mint.trim()); const connection = await verifiedConnection();
      const [currency] = PublicKey.findProgramAddressSync([Buffer.from("currency"), issued.toBuffer()], PROGRAM);
      const state = await connection.getAccountInfo(currency, "confirmed");
      if (!state || !state.owner.equals(PROGRAM) || state.data.length < 172) throw new Error("Verified Solo-X currency state was not found.");
      const vault = new PublicKey(state.data.subarray(105, 137));
      const [mintInfo, vaultInfo] = await connection.getMultipleAccountsInfo([issued, vault], "confirmed");
      if (!mintInfo || !vaultInfo || mintInfo.data.length < 82 || vaultInfo.data.length < 165) throw new Error("Supply or reserve account is unavailable.");
      const supply = mintInfo.data.readBigUInt64LE(36); const reserves = vaultInfo.data.readBigUInt64LE(64);
      setSnapshot({ supply, reserves, updated: new Date(), mint: issued.toBase58(), vault: vault.toBase58() });
    } catch (error) { setSnapshot(null); setMessage(error instanceof Error ? error.message : "RPC refresh failed."); } finally { setBusy(false); }
  }
  const ratio = snapshot && snapshot.supply > 0n ? Number(snapshot.reserves * 10_000n / snapshot.supply) / 100 : snapshot ? 100 : 0;
  const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "localnet" ? "custom" : "devnet";
  return <article className="module reserve-dashboard"><h2>Reserve transparency</h2><p>Read supply and collateral-vault reserves directly from the configured RPC.</p><div className="dashboard-form"><input aria-label="Issued mint address" placeholder="Issued mint address" value={mint} onChange={(event) => setMint(event.target.value)} disabled={busy}/><button className="wallet-button secondary" onClick={() => void refresh()} disabled={busy || !mint} type="button">{busy ? "Refreshing..." : "Refresh"}</button></div>
    {snapshot && <div className="reserve-values"><span>Supply <strong>{formatAmount(snapshot.supply)}</strong></span><span>Reserves <strong>{formatAmount(snapshot.reserves)}</strong></span><span className={snapshot.reserves >= snapshot.supply ? "backed" : "unbacked"}>Reserve ratio <strong>{ratio}%</strong></span><small>Updated {snapshot.updated.toLocaleTimeString()} - data may become stale; refresh before acting.</small><a href={`https://explorer.solana.com/address/${snapshot.mint}?cluster=${cluster}`} target="_blank" rel="noreferrer">Mint in explorer</a><a href={`https://explorer.solana.com/address/${snapshot.vault}?cluster=${cluster}`} target="_blank" rel="noreferrer">Vault in explorer</a></div>}{message && <p role="status">{message}</p>}</article>;
}
