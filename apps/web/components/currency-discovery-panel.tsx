"use client";
import { useState } from "react";
import { discoverCurrencies } from "./currency-identity";
import { verifiedConnection } from "./currency-transactions";

export function CurrencyDiscoveryPanel() {
  const [items,setItems] = useState<Awaited<ReturnType<typeof discoverCurrencies>>>([]);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  async function refresh() {
    setBusy(true); setItems([]); setMessage("");
    try {
      const found = await discoverCurrencies(await verifiedConnection());
      setItems(found); setMessage(found.length ? "Verified test-network currencies. Copy the full mint address to transact." : "No verified currencies found.");
    } catch { setMessage("Discovery unavailable. No currency identity has been verified."); }
    finally { setBusy(false); }
  }
  return <article className="module"><h2>Currency discovery</h2><p>Names and symbols are not proof of backing. Identify currencies by their full mint address. Verification is a point-in-time test-network check.</p>
    <button type="button" disabled={busy} onClick={()=>void refresh()}>{busy?"Checking…":"Discover verified currencies"}</button>
    <p role="status">{message}</p>
    <ul>{items.map(item=><li key={item.issued.toBase58()}><strong>Verified Solo-X currency</strong><p style={{overflowWrap:"anywhere"}}>{item.issued.toBase58()}</p><button type="button" onClick={()=>void navigator.clipboard.writeText(item.issued.toBase58()).catch(()=>setMessage("Copy failed; select the mint address manually."))}>Copy mint address</button></li>)}</ul>
  </article>;
}
