"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { parseAmount, formatAmount } from "./amount";
import { buildTransaction, loadAccounts, networkDisplayName, verifiedConnection, type Operation } from "./currency-transactions";
import { TransactionReview, useSafeTransaction } from "./transaction-review";

export function MintRedeemPanel() {
  const wallet = useWallet();
  const [mint, setMint] = useState("");
  const [amount, setAmount] = useState("");
  const [operation, setOperation] = useState<Operation>("mint");
  const [balances, setBalances] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const flow = useSafeTransaction();

  async function refresh() {
    if (flow.blocked || refreshing) return;
    setRefreshing(true); setBalances("");
    try {
      if (!wallet?.publicKey) throw new Error("Connect your test wallet first.");
      const holder = new PublicKey(wallet.publicKey.toBase58());
      const issued = new PublicKey(mint.trim());
      const connection = await verifiedConnection();
      const a = await loadAccounts(connection, holder, issued);
      setBalances("Issued: " + formatAmount(a.issuedAccount.balance) + " | Test USDC: " + formatAmount(a.collateralAccount.balance));
    } catch (error) {
      flow.setMessage(error instanceof Error ? error.message : "Balance refresh failed.");
    } finally { setRefreshing(false); }
  }

  async function prepare() {
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Connect a wallet that supports signing.");
    const holder = new PublicKey(wallet.publicKey.toBase58());
    const issued = new PublicKey(mint.trim());
    const units = parseAmount(amount);
    const connection = await verifiedConnection();
    const { transaction, block } = await buildTransaction(connection, holder, issued, operation, units);
    return {
      connection, block, transaction, wallet, walletAddress: holder.toBase58(),
      review: {
        action: operation === "mint" ? "Deposit test USDC and mint" : "Burn issued tokens and redeem test USDC",
        network: networkDisplayName(),
        wallet: holder.toBase58(),
        sourceMint: operation === "mint" ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" : issued.toBase58(),
        destination: operation === "mint" ? issued.toBase58() : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        amount: amount + " tokens (six decimals)",
        details: "Review token addresses and wallet network. Test funds only.",
      },
      afterConfirmed: async () => {
        setAmount("");
        const a = await loadAccounts(connection, holder, issued);
        setBalances("Issued: " + formatAmount(a.issuedAccount.balance) + " | Test USDC: " + formatAmount(a.collateralAccount.balance));
      },
    };
  }

  return <article className="module">
    <h2>Mint &amp; redeem</h2>
    <p>Exchange test USDC and issued tokens at 1:1. Existing token accounts are required.</p>
    <form onSubmit={(event) => { event.preventDefault(); void flow.start(prepare); }}>
      <label>Issued mint address <input required value={mint} disabled={flow.blocked || refreshing} onChange={(event) => { setMint(event.target.value); setBalances(""); }} /></label>
      <label>Operation <select value={operation} disabled={flow.blocked || refreshing} onChange={(event) => setOperation(event.target.value as Operation)}><option value="mint">Mint</option><option value="redeem">Redeem</option></select></label>
      <label>Amount <input required inputMode="decimal" value={amount} disabled={flow.blocked || refreshing} onChange={(event) => setAmount(event.target.value)} /></label>
      <button type="button" className="wallet-button secondary" disabled={flow.blocked || refreshing || !mint} onClick={() => void refresh()}>Refresh balances</button>
      <button type="submit" className="wallet-button" disabled={flow.blocked || refreshing || !mint || !amount}>{flow.busy ? "Working…" : "Review transaction"}</button>
    </form>
    {flow.review && <TransactionReview review={flow.review} busy={flow.busy} onApprove={() => void flow.approve()} onCancel={flow.cancel} />}
    {flow.pending && <p role="alert">Transaction {flow.pending} is unresolved. Do not submit another transaction.
      <button type="button" className="wallet-button secondary" disabled={flow.busy} onClick={() => void flow.recheck()}>Recheck on-chain status</button>
    </p>}
    {balances && <p role="status">{balances}</p>}
    {flow.message && <p role="status">{flow.message}</p>}
  </article>;
}
