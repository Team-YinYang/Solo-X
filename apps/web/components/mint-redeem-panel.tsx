"use client";

import { useRef, useState } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { parseAmount, formatAmount } from "./amount";
import { buildTransaction, loadAccounts, verifiedConnection, type Operation } from "./currency-transactions";

export function MintRedeemPanel() {
  const [mint, setMint] = useState("");
  const [amount, setAmount] = useState("");
  const [operation, setOperation] = useState<Operation>("mint");
  const [balances, setBalances] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function run(submit: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    setBalances("");
    let signature: string | undefined;
    let confirmed = false;
    try {
      const wallet = window.solana as (typeof window.solana & { signTransaction?: (transaction: Transaction) => Promise<Transaction> });
      if (!wallet?.publicKey) throw new Error("Connect your test wallet first.");
      const holder = new PublicKey(wallet.publicKey.toBase58());
      const issued = new PublicKey(mint.trim());
      const connection = await verifiedConnection();
      if (submit) {
        if (!wallet.signTransaction) throw new Error("Wallet does not support transaction signing.");
        const units = parseAmount(amount);
        const {transaction, block} = await buildTransaction(connection, holder, issued, operation, units);
        if (wallet.publicKey?.toBase58() !== holder.toBase58()) throw new Error("Wallet changed. Refresh and try again.");
        const signed = await wallet.signTransaction(transaction);
        signature = await connection.sendRawTransaction(signed.serialize(), {skipPreflight:false});
        const result = await connection.confirmTransaction({...block, signature}, "confirmed");
        if (result.value.err) throw new Error("Transaction failed on chain.");
        confirmed = true;
        setAmount("");
        setMessage("Confirmed: " + signature);
      }
      const a = await loadAccounts(connection, holder, issued);
      setBalances("Issued: " + formatAmount(a.issuedAccount.balance) + " | Test USDC: " + formatAmount(a.collateralAccount.balance));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unexpected transaction error.";
      setMessage(confirmed ? "Confirmed: " + signature + ". Balance refresh failed: " + detail : signature ? "Transaction submitted: " + signature + ". Check its status before retrying. " + detail : detail);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <article className="module">
    <h2>Mint &amp; redeem</h2>
    <p>Exchange test USDC and issued tokens at 1:1. Existing token accounts are required.</p>
    <form onSubmit={(event) => {event.preventDefault(); void run(true);}}>
      <label>Issued mint address <input required value={mint} disabled={busy} onChange={(event) => {setMint(event.target.value); setBalances("");}} /></label>
      <label>Operation <select value={operation} disabled={busy} onChange={(event) => setOperation(event.target.value as Operation)}><option value="mint">Mint</option><option value="redeem">Redeem</option></select></label>
      <label>Amount <input required inputMode="decimal" value={amount} disabled={busy} onChange={(event) => setAmount(event.target.value)} /></label>
      <button type="button" className="wallet-button secondary" disabled={busy || !mint} onClick={() => void run(false)}>Refresh balances</button>
      <button type="submit" className="wallet-button" disabled={busy || !mint || !amount}>{busy ? "Working…" : operation === "mint" ? "Deposit and mint" : "Burn and redeem"}</button>
    </form>
    {balances && <p role="status">{balances}</p>}
    {message && <p role="status">{message}</p>}
  </article>;
}
