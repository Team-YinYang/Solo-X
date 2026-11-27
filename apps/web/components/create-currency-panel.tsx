"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { networkDisplayName, verifiedConnection } from "./currency-transactions";
import { TransactionReview, useSafeTransaction } from "./transaction-review";

const PROGRAM = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const COLLATERAL = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

export function CreateCurrencyPanel() {
  const wallet = useWallet();
  const [accepted, setAccepted] = useState(false);
  const [mint, setMint] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const flow = useSafeTransaction();
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";

  async function prepare() {
    if (!accepted) throw new Error("Accept the test-network fee notice first.");
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
    return {
      connection, block, transaction, wallet, walletAddress: creator.toBase58(),
      review: {
        action: "Create six-decimal Solo-X currency",
        network: networkDisplayName(),
        wallet: creator.toBase58(),
        sourceMint: COLLATERAL.toBase58(),
        destination: issued.publicKey.toBase58(),
        amount: "0 new tokens; wallet pays network and account-creation fees",
        details: "Program: " + PROGRAM.toBase58() + ". State: " + currency.toBase58() + ". Vault: " + vault.toBase58(),
      },
      afterConfirmed: () => { setMint(issued.publicKey.toBase58()); setConfirmed(true); },
    };
  }

  const explorer = flow.pending && network === "devnet"
    ? "https://explorer.solana.com/tx/" + encodeURIComponent(flow.pending) + "?cluster=devnet"
    : null;

  return <article className="module">
    <h2>Create currency</h2>
    <p>Create a new six-decimal stablecoin with an isolated test-USDC vault. Creation does not mint tokens. Names and symbols are not supported by the current protocol.</p>
    <form onSubmit={(event) => { event.preventDefault(); void flow.start(prepare); }}>
      <label>Collateral <input readOnly value="Test USDC (1:1)" /></label>
      <label>Decimals <input readOnly value="6" /></label>
      <label><input type="checkbox" required checked={accepted} disabled={flow.blocked || confirmed} onChange={(event) => setAccepted(event.target.checked)} /> I understand this is a test currency and my wallet pays network and account creation fees.</label>
      <button className="wallet-button" type="submit" disabled={!accepted || flow.blocked || confirmed}>{flow.busy ? "Working…" : "Review currency creation"}</button>
    </form>
    {flow.review && <TransactionReview review={flow.review} onApprove={() => void flow.approve()} onCancel={flow.cancel} busy={flow.busy} />}
    {flow.pending && <p role="alert">Creation status unresolved: {flow.pending}. Do not create again until reconciled.
      <button className="wallet-button secondary" type="button" disabled={flow.busy} onClick={() => void flow.recheck()}>Recheck on-chain status</button>
      {explorer && <a href={explorer} target="_blank" rel="noopener noreferrer">View on Solana Explorer</a>}
    </p>}
    {flow.message && <p role="status">{flow.message}</p>}
    {mint && <p>Issued mint: <code style={{ overflowWrap: "anywhere" }}>{mint}</code></p>}
    {confirmed && <button className="wallet-button secondary" type="button" onClick={() => { setMint(""); setConfirmed(false); setAccepted(false); flow.setMessage(""); }}>Create another currency</button>}
  </article>;
}
