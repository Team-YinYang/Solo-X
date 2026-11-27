"use client";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { formatAmount } from "./amount";
import { verifiedConnection } from "./currency-transactions";
import { evaluateReserveHealth, type ReserveSample } from "./reserve-health";

const PROGRAM = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const COLLATERAL = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
type Health = ReturnType<typeof evaluateReserveHealth>;
type Snapshot = { supply: bigint; reserves: bigint; mint: string; vault: string; health: Health; slot: number; checkedAt: Date };
const key = (data: Buffer, offset: number, expected: PublicKey) =>
  new PublicKey(data.subarray(offset, offset + 32)).equals(expected);

export function ReserveDashboard() {
  const [mint, setMint] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function refresh() {
    if (busy) return;
    setBusy(true); setSnapshot(null); setMessage("");
    try {
      const issued = new PublicKey(mint.trim());
      if (issued.equals(COLLATERAL)) throw new Error("Unsupported mint");
      const connection = await verifiedConnection();
      const [currency, stateBump] = PublicKey.findProgramAddressSync([Buffer.from("currency"), issued.toBuffer()], PROGRAM);
      const [vault, vaultBump] = PublicKey.findProgramAddressSync([Buffer.from("vault"), currency.toBuffer()], PROGRAM);
      const [authority, authorityBump] = PublicKey.findProgramAddressSync([Buffer.from("authority"), currency.toBuffer()], PROGRAM);
      const response = await connection.getMultipleAccountsInfoAndContext([currency, issued, vault, COLLATERAL], "confirmed");
      const [state, issuedInfo, vaultInfo, collateralInfo] = response.value;
      const discriminator = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("account:CurrencyState"))).subarray(0, 8);
      const valid = !!state && !!issuedInfo && !!vaultInfo && !!collateralInfo &&
        state.owner.equals(PROGRAM) && state.data.length === 172 && state.data.subarray(0, 8).equals(discriminator) &&
        state.data[8] === 1 && key(state.data, 41, issued) && key(state.data, 73, COLLATERAL) &&
        key(state.data, 105, vault) && key(state.data, 137, authority) &&
        state.data[169] === stateBump && state.data[170] === vaultBump && state.data[171] === authorityBump &&
        issuedInfo.owner.equals(TOKEN) && issuedInfo.data.length === 82 && issuedInfo.data.readUInt32LE(0) === 1 &&
        key(issuedInfo.data, 4, authority) && issuedInfo.data[44] === 6 && issuedInfo.data[45] === 1 &&
        issuedInfo.data.readUInt32LE(46) === 0 &&
        collateralInfo.owner.equals(TOKEN) && collateralInfo.data.length === 82 &&
        collateralInfo.data[44] === 6 && collateralInfo.data[45] === 1 &&
        vaultInfo.owner.equals(TOKEN) && vaultInfo.data.length === 165 &&
        key(vaultInfo.data, 0, COLLATERAL) && key(vaultInfo.data, 32, authority) &&
        vaultInfo.data.readUInt32LE(72) === 0 && vaultInfo.data[108] === 1 &&
        vaultInfo.data.readUInt32LE(109) === 0 && vaultInfo.data.readUInt32LE(129) === 0;
      if (!valid || !issuedInfo || !vaultInfo) throw new Error("Invalid currency state");
      const [latestSlot, blockTimeSeconds] = await Promise.all([
        connection.getSlot("confirmed"), connection.getBlockTime(response.context.slot),
      ]);
      const checkedAt = new Date();
      const supply = issuedInfo.data.readBigUInt64LE(36);
      const reserves = vaultInfo.data.readBigUInt64LE(64);
      const sample: ReserveSample = {
        supply, reserves, sampleSlot: response.context.slot, latestSlot,
        blockTimeSeconds, nowMs: checkedAt.getTime(), identityVerified: true,
      };
      setSnapshot({ supply, reserves, mint: issued.toBase58(), vault: vault.toBase58(),
        slot: response.context.slot, checkedAt, health: evaluateReserveHealth(sample) });
    } catch {
      // Never emit RPC internals, wallet data, or private endpoint URLs.
      setSnapshot(null);
      setMessage("Reserve/RPC health could not be verified. Confirm the test network and retry.");
    } finally { setBusy(false); }
  }
  const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "localnet" ? "custom" : "devnet";
  return <article className="module reserve-dashboard">
    <h2>Reserve transparency</h2>
    <p>Read-only supply, collateral and RPC health checks on test networks.</p>
    <div className="dashboard-form">
      <input aria-label="Issued mint address" placeholder="Issued mint address" value={mint}
        onChange={(event) => { setMint(event.target.value); setSnapshot(null); }} disabled={busy} />
      <button className="wallet-button secondary" onClick={() => void refresh()} disabled={busy || !mint}
        type="button">{busy ? "Refreshing..." : "Refresh health"}</button>
    </div>
    {snapshot && <div className="reserve-values">
      <p role="status">Health: <strong>{snapshot.health.status.toUpperCase()}</strong></p>
      {snapshot.health.warnings.includes("reserve-shortfall") && <p role="alert">
        Reserve shortfall: {formatAmount(snapshot.health.deficit)} test collateral tokens missing. Full redemption coverage is not available.
      </p>}
      {snapshot.health.warnings.includes("rpc-stale") && <p role="alert">
        Stale RPC data: the observed slot or timestamp is too old. Refresh and verify with another trusted RPC.
      </p>}
      {snapshot.health.warnings.includes("rpc-time-unavailable") && <p role="alert">
        RPC freshness is unverified because the block timestamp is missing or invalid.
      </p>}
      {snapshot.health.warnings.includes("unverified") && <p role="alert">
        Currency identity or RPC ordering is unverified.
      </p>}
      <span>Supply <strong>{formatAmount(snapshot.supply)}</strong></span>
      <span>Reserves <strong>{formatAmount(snapshot.reserves)}</strong></span>
      <span className={snapshot.reserves >= snapshot.supply ? "backed" : "unbacked"}>
        Reserve ratio <strong>{snapshot.health.ratioBasisPoints === null ? "N/A (zero supply)" :
          (snapshot.health.ratioBasisPoints / 100n).toString() + "." +
          (snapshot.health.ratioBasisPoints % 100n).toString().padStart(2, "0") + "%"}</strong>
      </span>
      <small>RPC slot {snapshot.slot}, observed lag {snapshot.health.slotLag ?? "unknown"} slots,
        age {snapshot.health.ageSeconds ?? "unknown"} seconds. Checked {snapshot.checkedAt.toLocaleTimeString()}.
        Refresh before acting.</small>
      <a href={"https://explorer.solana.com/address/" + snapshot.mint + "?cluster=" + cluster} target="_blank" rel="noreferrer">Mint in explorer</a>
      <a href={"https://explorer.solana.com/address/" + snapshot.vault + "?cluster=" + cluster} target="_blank" rel="noreferrer">Vault in explorer</a>
    </div>}
    {message && <p role="alert">{message}</p>}
  </article>;
}
