"use client";

import { useRef, useState } from "react";
import type { BlockhashWithExpiryBlockHeight, Connection, Transaction } from "@solana/web3.js";
import { reconcileTransaction, signedSignature } from "./transaction-status";

type Signer = {
  publicKey?: { toBase58: () => string };
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
};

export type Review = {
  action: string;
  network: string;
  wallet: string;
  sourceMint: string;
  destination: string;
  amount: string;
  details?: string;
};

type Prepared = {
  connection: Connection;
  block: BlockhashWithExpiryBlockHeight;
  transaction: Transaction;
  wallet: Signer;
  walletAddress: string;
  review: Review;
  afterConfirmed?: (signature: string) => Promise<void> | void;
};

type Pending = {
  signature: string;
  connection: Connection;
  block: BlockhashWithExpiryBlockHeight;
  afterConfirmed?: (signature: string) => Promise<void> | void;
};

export function useSafeTransaction() {
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const lock = useRef(false);
  const prepared = useRef<Prepared | null>(null);
  const unresolved = useRef<Pending | null>(null);
  const blocked = busy || !!review || !!pending;

  async function start(prepare: () => Promise<Prepared>) {
    if (lock.current || prepared.current || unresolved.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const next = await prepare();
      if (next.wallet.publicKey?.toBase58() !== next.walletAddress) throw new Error("Wallet changed. Reconnect and review again.");
      prepared.current = next;
      setReview(next.review);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to prepare transaction."); }
    finally { lock.current = false; setBusy(false); }
  }

  function cancel() {
    if (lock.current || unresolved.current) return;
    prepared.current = null; setReview(null);
  }

  async function approve() {
    if (lock.current || unresolved.current || !prepared.current) return;
    lock.current = true; setBusy(true); setMessage("");
    const current = prepared.current;
    prepared.current = null; setReview(null);
    try {
      const { wallet, walletAddress, connection, transaction, block } = current;
      if (!wallet.signTransaction) throw new Error("Wallet cannot sign transactions.");
      if (wallet.publicKey?.toBase58() !== walletAddress) throw new Error("Wallet changed. Nothing was submitted.");
      if (await connection.getBlockHeight("confirmed") > block.lastValidBlockHeight) throw new Error("Review expired before signing. Prepare a new transaction.");
      const signed = await wallet.signTransaction(transaction);
      if (wallet.publicKey?.toBase58() !== walletAddress) throw new Error("Wallet changed. Nothing was submitted.");
      const signatureBytes = signed.signature;
      if (!signatureBytes) throw new Error("Wallet returned an unsigned transaction.");
      const signature = signedSignature(signatureBytes);
      const attempt: Pending = { signature, connection, block, afterConfirmed: current.afterConfirmed };
      // Install the pending lock BEFORE the RPC call: send failures can still land on chain.
      unresolved.current = attempt; setPending(signature);
      const remote = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
      if (remote !== signature) throw new Error("RPC returned an unexpected signature.");
      const result = await connection.confirmTransaction({ ...block, signature }, "confirmed");
      if (result.value.err) {
        setMessage("Transaction failed on chain: " + signature + ". You may prepare a new attempt.");
        unresolved.current = null; setPending(null);
        return;
      }
      unresolved.current = null; setPending(null);
      setMessage("Confirmed: " + signature);
      try { await current.afterConfirmed?.(signature); }
      catch (error) { setMessage("Confirmed: " + signature + ". Refresh failed: " + (error instanceof Error ? error.message : "RPC error.")); }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unexpected transaction error.";
      setMessage(unresolved.current
        ? "Submission status uncertain. Do not retry. Recheck transaction status first. " + detail
        : "Not submitted (or wallet rejected). " + detail);
    } finally { lock.current = false; setBusy(false); }
  }

  async function recheck() {
    if (lock.current || !unresolved.current) return;
    lock.current = true; setBusy(true);
    const attempt = unresolved.current;
    try {
      const status = await reconcileTransaction(attempt.connection, attempt.signature, attempt.block);
      if (status === "pending") {
        setMessage("Still pending or unverified. Do not retry; recheck later.");
      } else {
        unresolved.current = null; setPending(null);
        if (status === "confirmed") {
          setMessage("Confirmed: " + attempt.signature);
          try { await attempt.afterConfirmed?.(attempt.signature); }
          catch { setMessage("Confirmed: " + attempt.signature + ". Balance refresh failed."); }
        } else {
          setMessage(status === "failed"
            ? "On-chain failure verified. A new attempt is permitted."
            : "Blockhash expired and no transaction was found in RPC history. A new reviewed attempt is permitted; verify with another RPC if uncertain.");
        }
      }
    } catch {
      setMessage("RPC reconciliation unavailable. Retry remains blocked; recheck later.");
    } finally { lock.current = false; setBusy(false); }
  }

  return { busy, blocked, review, pending, message, setMessage, start, cancel, approve, recheck };
}

export function TransactionReview({ review, onApprove, onCancel, busy }: {
  review: Review; onApprove: () => void; onCancel: () => void; busy: boolean;
}) {
  return <section className="transaction-review" aria-label="Review transaction before signing">
    <h3>Review before signing</h3>
    <p>Check every field. Nothing has been submitted or signed yet.</p>
    <dl>
      <dt>Action</dt><dd>{review.action}</dd>
      <dt>Network</dt><dd>{review.network}</dd>
      <dt>Wallet</dt><dd><code>{review.wallet}</code></dd>
      <dt>Source mint</dt><dd><code>{review.sourceMint}</code></dd>
      <dt>Destination mint / account</dt><dd><code>{review.destination}</code></dd>
      <dt>Amount</dt><dd>{review.amount}</dd>
      {review.details && <><dt>Notes</dt><dd>{review.details}</dd></>}
    </dl>
    <button className="wallet-button secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
    <button className="wallet-button" type="button" onClick={onApprove} disabled={busy}>{busy ? "Working…" : "Confirm review & sign"}</button>
  </section>;
}
