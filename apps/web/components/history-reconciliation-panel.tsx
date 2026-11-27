"use client";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";
import { verifiedConnection } from "./currency-transactions";
import { historyPage, reconcile, PAGE_SIZE, type HistoryEntry } from "./history-model";
import { formatAmount } from "./amount";

const PROGRAM=new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const TOKEN=new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const COLLATERAL=new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export function HistoryReconciliationPanel(){
 const [mint,setMint]=useState("");
 const [rows,setRows]=useState<HistoryEntry[]>([]);
 const [cursor,setCursor]=useState<string>();
 const [snapshot,setSnapshot]=useState<{supply:bigint;reserves:bigint;slot:number}|null>(null);
 const [historyError,setHistoryError]=useState("");
 const [reserveError,setReserveError]=useState("");
 const [busy,setBusy]=useState(false);
 async function refresh(more:boolean){
  setBusy(true);setHistoryError("");setReserveError("");setSnapshot(null);
  if(!more){setRows([]);setCursor(undefined);}
  try{
   const connection=await verifiedConnection();
   const issued=new PublicKey(mint.trim());
   const [state,sb]=PublicKey.findProgramAddressSync([Buffer.from("currency"),issued.toBuffer()],PROGRAM);
   const [vault,vb]=PublicKey.findProgramAddressSync([Buffer.from("vault"),state.toBuffer()],PROGRAM);
   const [authority,ab]=PublicKey.findProgramAddressSync([Buffer.from("authority"),state.toBuffer()],PROGRAM);
   const key=(data:Buffer,offset:number,expected:PublicKey)=>new PublicKey(data.subarray(offset,offset+32)).equals(expected);
   try{
    const result=await connection.getMultipleAccountsInfoAndContext([state,issued,vault,COLLATERAL],"confirmed");
    const [s,m,v,c]=result.value;
    const disc=Buffer.from(await crypto.subtle.digest("SHA-256",new TextEncoder().encode("account:CurrencyState"))).subarray(0,8);
    if(issued.equals(COLLATERAL)||!s||!s.owner.equals(PROGRAM)||s.data.length!==172||!s.data.subarray(0,8).equals(disc)||s.data[8]!==1||!key(s.data,41,issued)||!key(s.data,73,COLLATERAL)||!key(s.data,105,vault)||!key(s.data,137,authority)||s.data[169]!==sb||s.data[170]!==vb||s.data[171]!==ab||!m||!m.owner.equals(TOKEN)||m.data.length!==82||m.data.readUInt32LE(0)!==1||!key(m.data,4,authority)||m.data[44]!==6||m.data[45]!==1||m.data.readUInt32LE(46)!==0||!v||!v.owner.equals(TOKEN)||v.data.length!==165||!key(v.data,0,COLLATERAL)||!key(v.data,32,authority)||v.data[108]!==1||v.data.readUInt32LE(72)!==0||v.data.readUInt32LE(129)!==0||!c||!c.owner.equals(TOKEN)||c.data.length!==82||c.data[44]!==6||c.data[45]!==1)throw Error("Canonical reserve accounts could not be verified.");
    setSnapshot({supply:m.data.readBigUInt64LE(36),reserves:v.data.readBigUInt64LE(64),slot:result.context.slot});
   }catch(error){setReserveError(error instanceof Error?error.message:"Reserve RPC unavailable.");}
   try{
    const page=await historyPage(async before=>connection.getSignaturesForAddress(state,{limit:PAGE_SIZE,before},"confirmed"),more?cursor:undefined);
    setRows(previous=>more?[...previous,...page.rows.filter(row=>!previous.some(old=>old.signature===row.signature))]:page.rows);setCursor(page.next);
   }catch(error){setHistoryError(error instanceof Error?error.message:"History RPC unavailable.");}
  }catch(error){const message=error instanceof Error?error.message:"RPC unavailable.";setHistoryError(message);setReserveError(message);}
  finally{setBusy(false);}
 }
 const balance=snapshot?reconcile(snapshot.supply,snapshot.reserves):null;
 return <article className="module"><h2>Activity and reserve reconciliation</h2><p>Confirmed currency-state account activity, not a complete token transfer ledger. History is never used to calculate backing.</p><label>Issued mint <input value={mint} disabled={busy} onChange={e=>{setMint(e.target.value);setRows([]);setCursor(undefined);setSnapshot(null);setHistoryError("");setReserveError("");}}/></label><button type="button" disabled={busy||!mint} onClick={()=>void refresh(false)}>Refresh activity and reserves</button>
 {snapshot&&balance&&<p>Slot {snapshot.slot}: supply {formatAmount(snapshot.supply)}, reserves {formatAmount(snapshot.reserves)}, surplus {formatAmount(balance.surplus)}, deficit {formatAmount(balance.deficit)}. {balance.covered?"Covered at snapshot":"Reserve deficit"}.</p>}
 {reserveError&&<p role="alert">Reserve verification unavailable: {reserveError}</p>}
 {historyError&&<p role="alert">History unavailable: {historyError}</p>}
 <ul>{rows.map(row=><li key={row.signature} style={{overflowWrap:"anywhere"}}>{row.err?"Failed":"Confirmed"} · slot {row.slot} · {row.signature}</li>)}</ul>
 {cursor&&<button type="button" disabled={busy} onClick={()=>void refresh(true)}>Load next 20</button>}
 </article>;
}
