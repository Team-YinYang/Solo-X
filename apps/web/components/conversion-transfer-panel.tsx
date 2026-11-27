"use client";

import { useState } from "react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { formatAmount, parseAmount } from "./amount";
import { loadAccounts, verifiedConnection } from "./currency-transactions";

const PROGRAM = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

type Mode = "convert" | "transfer";
type SigningWallet = { publicKey?: { toBase58: () => string }; signTransaction?: (transaction: Transaction) => Promise<Transaction> };

function u64(value: bigint) { const data = Buffer.alloc(8); data.writeBigUInt64LE(value); return data; }
function anchorData(discriminator: readonly number[], amount: bigint) { return Buffer.concat([Buffer.from(discriminator), u64(amount)]); }

export function ConversionTransferPanel() {
  const [mode, setMode] = useState<Mode>("convert");
  const [sourceMint, setSourceMint] = useState("");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const wallet = window.solana as SigningWallet | undefined;
      if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Connect a wallet that supports transaction signing first.");
      const holder = new PublicKey(wallet.publicKey.toBase58());
      const source = new PublicKey(sourceMint.trim());
      const units = parseAmount(amount);
      const connection = await verifiedConnection();
      const sourceAccounts = await loadAccounts(connection, holder, source);
      if (units > sourceAccounts.issuedAccount.balance) throw new Error("Insufficient source-currency balance.");
      let instruction: TransactionInstruction;
      if (mode === "transfer") {
        const recipientTokenAccount = new PublicKey(destination.trim());
        instruction = new TransactionInstruction({ programId: TOKEN, keys: [
          { pubkey: sourceAccounts.issuedAccount.key, isSigner: false, isWritable: true },
          { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
          { pubkey: holder, isSigner: true, isWritable: false },
        ], data: Buffer.concat([Buffer.from([3]), u64(units)]) });
      } else {
        const destinationMint = new PublicKey(destination.trim());
        if (destinationMint.equals(source)) throw new Error("Choose two distinct compatible currencies.");
        const destinationAccounts = await loadAccounts(connection, holder, destinationMint);
        instruction = new TransactionInstruction({ programId: PROGRAM, keys: [
          { pubkey: holder, isSigner: true, isWritable: false },
          { pubkey: sourceAccounts.currency, isSigner: false, isWritable: false },
          { pubkey: destinationAccounts.currency, isSigner: false, isWritable: false },
          { pubkey: source, isSigner: false, isWritable: true },
          { pubkey: destinationMint, isSigner: false, isWritable: true },
          { pubkey: sourceAccounts.collateralAccount.key, isSigner: false, isWritable: false },
          { pubkey: sourceAccounts.vault, isSigner: false, isWritable: true },
          { pubkey: destinationAccounts.vault, isSigner: false, isWritable: true },
          { pubkey: sourceAccounts.authority, isSigner: false, isWritable: false },
          { pubkey: destinationAccounts.authority, isSigner: false, isWritable: false },
          { pubkey: sourceAccounts.issuedAccount.key, isSigner: false, isWritable: true },
          { pubkey: destinationAccounts.issuedAccount.key, isSigner: false, isWritable: true },
          { pubkey: TOKEN, isSigner: false, isWritable: false },
        ], data: anchorData([89, 185, 237, 218, 23, 6, 98, 250], units) });
      }
      const block = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({ feePayer: holder, blockhash: block.blockhash, lastValidBlockHeight: block.lastValidBlockHeight }).add(instruction);
      const signed = await wallet.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      const result = await connection.confirmTransaction({ ...block, signature }, "confirmed");
      if (result.value.err) throw new Error("Transaction failed on chain; all state changes were rolled back.");
      setAmount(""); setMessage(`Confirmed ${mode}: ${signature}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unexpected transaction error."); }
    finally { setBusy(false); }
  }

  return <article className="module operation-panel"><h2>Convert & transfer</h2><p>Conversions require two verified Solo-X currencies with the same configured test collateral. Transfers use standard SPL Token transfer.</p>
    <form onSubmit={(event) => void submit(event)}>
      <label>Action <select value={mode} onChange={(event) => setMode(event.target.value as Mode)} disabled={busy}><option value="convert">Convert compatible currency</option><option value="transfer">Transfer issued tokens</option></select></label>
      <label>Source issued mint <input required value={sourceMint} onChange={(event) => setSourceMint(event.target.value)} disabled={busy} /></label>
      <label>{mode === "convert" ? "Destination issued mint" : "Recipient token account"}<input required value={destination} onChange={(event) => setDestination(event.target.value)} disabled={busy} /></label>
      <label>Amount <input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} /></label>
      <button className="wallet-button" disabled={busy}>{busy ? "Awaiting wallet..." : mode === "convert" ? "Convert" : "Transfer"}</button>
    </form>{message && <p role="status">{message}</p>}</article>;
}
