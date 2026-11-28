"use client";
import { useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { executeBulkTransfers, planBulkTransfers, type TransferResult, type BulkTransport } from "@solo-x/sdk";
import { parseAmount } from "./amount";
import { loadAccounts, verifiedConnection } from "./currency-transactions";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const STORAGE = "solo-x-bulk-v1";
type Saved = { scope: string; entries: Array<Omit<TransferResult,"row"> & {row: {id:string; recipient:string; amount:string}}> };

export function BulkTransferPanel() {
  const wallet = useWallet();
  const [mint,setMint] = useState("");
  const [input,setInput] = useState("");
  const [results,setResults] = useState<TransferResult[]>([]);
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const running = useRef(false);
  async function run(retry: boolean) {
    if (running.current) return;
    running.current = true; setBusy(true); setMessage("");
    try {
      if (!navigator.locks) throw new Error("Browser must support exclusive Web Locks for safe retries.");
      await navigator.locks.request(STORAGE, async () => {
        if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Connect a signing wallet first.");
        const holder = new PublicKey(wallet.publicKey.toBase58());
        const issued = new PublicKey(mint.trim());
        const connection = await verifiedConnection();
        const scope = JSON.stringify([connection.rpcEndpoint,await connection.getGenesisHash(),holder.toBase58(),issued.toBase58()]);
        const savedText = localStorage.getItem(STORAGE);
        const saved = savedText ? JSON.parse(savedText) as Saved : null;
        let journal: TransferResult[];
        if (retry) {
          if (!saved || saved.scope !== scope) throw new Error("No saved batch for this wallet, mint and network.");
          journal = saved.entries.map(entry=>({...entry,row:{...entry.row,amount:BigInt(entry.row.amount)}}));
        } else {
          if (saved && saved.entries.some(entry=>entry.status!=="confirmed")) throw new Error("Resolve the existing batch before starting another.");
          journal = planBulkTransfers(input.trim().split(/\r?\n/).map((line,i)=>{
            const parts=line.split(",").map(s=>s.trim());
            if(parts.length!==2) throw new Error("Use recipient wallet,amount on each line.");
            return {id:String(i+1),recipient:new PublicKey(parts[0]).toBase58(),amount:parseAmount(parts[1])};
          }));
        }
        const persist = async (entries: readonly TransferResult[]) => {
          localStorage.setItem(STORAGE,JSON.stringify({scope,entries:entries.map(entry=>({...entry,row:{...entry.row,amount:entry.row.amount.toString()}}))}));
          setResults([...entries]);
        };
        await persist(journal);
        const transport: BulkTransport = {
          async prepare(row) {
            if(wallet.publicKey?.toBase58()!==holder.toBase58()) throw new Error("Wallet changed.");
            const source = await loadAccounts(connection,holder,issued);
            if(row.amount>source.issuedAccount.balance) throw new Error("Insufficient issued balance.");
            const recipient = new PublicKey(row.recipient);
            const accounts = await connection.getTokenAccountsByOwner(recipient,{mint:issued});
            const destination = accounts.value.find(({account})=>account.owner.equals(TOKEN)&&account.data.length===165&&account.data[108]===1);
            if(!destination || destination.pubkey.equals(source.issuedAccount.key)) throw new Error("Recipient needs a distinct initialized token account.");
            const data=Buffer.alloc(10); data[0]=12; data.writeBigUInt64LE(row.amount,1); data[9]=6;
            const keys=[source.issuedAccount.key,issued,destination.pubkey,holder].map((pubkey,i)=>({pubkey,isSigner:i===3,isWritable:i===0||i===2}));
            const block=await connection.getLatestBlockhash("confirmed");
            const tx=new Transaction({feePayer:holder,blockhash:block.blockhash,lastValidBlockHeight:block.lastValidBlockHeight}).add(new TransactionInstruction({programId:TOKEN,keys,data}));
            const signed=await wallet.signTransaction!(tx);
            const bytes=signed.serialize();
            const signatureBytes=signed.signature;
            if(!signatureBytes) throw new Error("Missing wallet signature.");
            const alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
            let n=0n; for(const byte of signatureBytes) n=(n<<8n)+BigInt(byte);
            let signature=""; while(n>0n){signature=alphabet[Number(n%58n)]+signature;n/=58n;}
            for(const byte of signatureBytes){if(byte!==0)break;signature="1"+signature;}
            return {signature,async broadcast(){await connection.sendRawTransaction(bytes,{skipPreflight:false});}};
          },
          async status(signature) {
            const response=await connection.getSignatureStatuses([signature],{searchTransactionHistory:true});
            const status=response.value[0];
            if(status?.confirmationStatus!=="finalized") return "unknown";
            return status.err?"failed":"confirmed";
          }
        };
        await executeBulkTransfers(journal,transport,persist);
        setMessage("Batch processed. Reconcile unknown transactions before retrying.");
      });
    } catch(error){setMessage(error instanceof Error?error.message:String(error));}
    finally{running.current=false;setBusy(false);}
  }
  return <article className="module"><h2>Bulk token transfers</h2><p>Test funds only. Up to 20 recipients with existing token accounts. Enter one wallet address,amount per line.</p>
    <label>Issued mint <input value={mint} disabled={busy} onChange={e=>setMint(e.target.value)}/></label>
    <label>Recipients <textarea value={input} disabled={busy} onChange={e=>setInput(e.target.value)}/></label>
    <button type="button" disabled={busy||!mint||!input} onClick={()=>void run(false)}>Send batch</button>
    <button type="button" disabled={busy||!mint} onClick={()=>void run(true)}>Resume / reconcile saved batch</button>
    <p role="status">{message}</p>
    <ul>{results.map(entry=><li key={entry.row.id}>{entry.row.recipient}: {entry.status} {entry.signature} {entry.error}</li>)}</ul>
  </article>;
}
