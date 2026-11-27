"use client";

import { useRef, useState } from "react";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { verifiedConnection } from "./currency-transactions";

const PROGRAM = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const COLLATERAL = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export function CreateCurrencyPanel() {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [mint, setMint] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false);
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";

  async function create() {
    if (lock.current || !accepted || signature) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setMint("");
    setConfirmed(false);
    try {
      const wallet = window.solana as (typeof window.solana & { signTransaction?: (transaction: Transaction) => Promise<Transaction> });
      if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Connect a compatible test wallet first.");
      const creator = new PublicKey(wallet.publicKey.toBase58());
      const connection = await verifiedConnection();
      const program = await connection.getAccountInfo(PROGRAM);
      if (!program?.executable) throw new Error("Solo-X is not deployed on this RPC.");
      const collateral = await connection.getAccountInfo(COLLATERAL);
      if (!collateral || !collateral.owner.equals(TOKEN) || collateral.data.length !== 82 || collateral.data[44] !== 6 || collateral.data[45] !== 1) throw new Error("Configured test USDC mint is unavailable or invalid.");
      const issued = Keypair.generate();
      const [currency] = PublicKey.findProgramAddressSync([Buffer.from("currency"), issued.publicKey.toBuffer()], PROGRAM);
      const [authority] = PublicKey.findProgramAddressSync([Buffer.from("authority"), currency.toBuffer()], PROGRAM);
      const [vault] = PublicKey.findProgramAddressSync([Buffer.from("vault"), currency.toBuffer()], PROGRAM);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("global:create_currency"));
      const keys = [creator, issued.publicKey, currency, COLLATERAL, authority, vault, TOKEN, SystemProgram.programId].map((pubkey, i) => ({ pubkey, isSigner: i === 0 || i === 1, isWritable: [0, 1, 2, 5].includes(i) }));
      const block = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({ feePayer: creator, blockhash: block.blockhash, lastValidBlockHeight: block.lastValidBlockHeight }).add(new TransactionInstruction({ programId: PROGRAM, keys, data: Buffer.from(digest).subarray(0, 8) }));
      transaction.partialSign(issued);
      if (wallet.publicKey?.toBase58() !== creator.toBase58()) throw new Error("Wallet changed. Reconnect and try again.");
      const signed = await wallet.signTransaction(transaction);
      if (wallet.publicKey?.toBase58() !== creator.toBase58()) throw new Error("Wallet changed before submission.");
      setMint(issued.publicKey.toBase58());
      const txid = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      setSignature(txid);
      setMessage("Submitted. Waiting for confirmation…");
      const result = await connection.confirmTransaction({ ...block, signature: txid }, "confirmed");
      if (result.value.err) throw new Error("Transaction failed on chain. Inspect the explorer before retrying.");
      setConfirmed(true);
      setMessage("Currency created and confirmed. Initial supply is zero.");
    } catch (error) {
      setMessage((error instanceof Error ? error.message : "Unexpected creation error.") + " If submission is uncertain, inspect your wallet history before retrying.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const explorer = signature && (network === "devnet" ? "https://explorer.solana.com/tx/" + encodeURIComponent(signature) + "?cluster=devnet" : "https://explorer.solana.com/tx/" + encodeURIComponent(signature) + "?cluster=custom&customUrl=" + encodeURIComponent(process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "http://127.0.0.1:8899"));

  return <article className="module">
    <h2>Create currency</h2>
    <p>Create a new six-decimal stablecoin with an isolated test-USDC vault. Creation does not mint tokens. Names and symbols are not supported by the current protocol.</p>
    <form onSubmit={(event) => { event.preventDefault(); void create(); }}>
      <label>Collateral <input readOnly value="Test USDC (1:1)" /></label>
      <label>Decimals <input readOnly value="6" /></label>
      <label><input type="checkbox" required checked={accepted} disabled={busy || !!signature} onChange={(event) => setAccepted(event.target.checked)} /> I understand this is a test currency and my wallet pays network and account creation fees.</label>
      <button className="wallet-button" type="submit" disabled={!accepted || busy || !!signature}>{busy ? "Creating…" : "Create stablecoin"}</button>
    </form>
    {message && <p role="status">{message}</p>}
    {mint && <p>{confirmed ? "Issued mint" : "Attempted mint"}: <code style={{ overflowWrap: "anywhere" }}>{mint}</code></p>}
    {explorer && <p><a href={explorer} target="_blank" rel="noopener noreferrer">View transaction in Solana Explorer</a></p>}
    {confirmed && <button className="wallet-button secondary" type="button" onClick={() => { setSignature(""); setMint(""); setConfirmed(false); setAccepted(false); setMessage(""); }}>Create another currency</button>}
  </article>;
}
