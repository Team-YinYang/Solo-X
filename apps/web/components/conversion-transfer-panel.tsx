"use client";

import { useState } from "react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { parseAmount } from "./amount";
import { loadAccounts, verifiedConnection } from "./currency-transactions";
import { TransactionReview, useSafeTransaction } from "./transaction-review";

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
  const flow = useSafeTransaction();
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";

  async function prepare() {
    const wallet = window.solana as SigningWallet | undefined;
    if (!wallet?.publicKey || !wallet.signTransaction) throw new Error("Connect a wallet that supports transaction signing first.");
    const holder = new PublicKey(wallet.publicKey.toBase58());
    const source = new PublicKey(sourceMint.trim());
    const units = parseAmount(amount);
    const connection = await verifiedConnection();
    const sourceAccounts = await loadAccounts(connection, holder, source);
    if (units > sourceAccounts.issuedAccount.balance) throw new Error("Insufficient source-currency balance.");
    let instruction: TransactionInstruction;
    let target: PublicKey;
    if (mode === "transfer") {
      target = new PublicKey(destination.trim());
      const account = await connection.getAccountInfo(target);
      if (!account || !account.owner.equals(TOKEN) || account.data.length !== 165 ||
          !new PublicKey(account.data.subarray(0, 32)).equals(source) || account.data[108] !== 1) {
        throw new Error("Recipient token account is not an initialized account for the selected issued mint.");
      }
      instruction = new TransactionInstruction({ programId: TOKEN, keys: [
        { pubkey: sourceAccounts.issuedAccount.key, isSigner: false, isWritable: true },
        { pubkey: target, isSigner: false, isWritable: true },
        { pubkey: holder, isSigner: true, isWritable: false },
      ], data: Buffer.concat([Buffer.from([3]), u64(units)]) });
    } else {
      target = new PublicKey(destination.trim());
      if (target.equals(source)) throw new Error("Choose two distinct compatible currencies.");
      const dest = await loadAccounts(connection, holder, target);
      instruction = new TransactionInstruction({ programId: PROGRAM, keys: [
        { pubkey: holder, isSigner: true, isWritable: false },
        { pubkey: sourceAccounts.currency, isSigner: false, isWritable: false },
        { pubkey: dest.currency, isSigner: false, isWritable: false },
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: target, isSigner: false, isWritable: true },
        { pubkey: sourceAccounts.collateralAccount.key, isSigner: false, isWritable: false },
        { pubkey: sourceAccounts.vault, isSigner: false, isWritable: true },
        { pubkey: dest.vault, isSigner: false, isWritable: true },
        { pubkey: sourceAccounts.authority, isSigner: false, isWritable: false },
        { pubkey: dest.authority, isSigner: false, isWritable: false },
        { pubkey: sourceAccounts.issuedAccount.key, isSigner: false, isWritable: true },
        { pubkey: dest.issuedAccount.key, isSigner: false, isWritable: true },
        { pubkey: TOKEN, isSigner: false, isWritable: false },
      ], data: anchorData([89, 185, 237, 218, 23, 6, 98, 250], units) });
    }
    const block = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({ feePayer: holder, blockhash: block.blockhash, lastValidBlockHeight: block.lastValidBlockHeight }).add(instruction);
    return {
      connection, block, transaction, wallet, walletAddress: holder.toBase58(),
      review: {
        action: mode === "convert" ? "Convert compatible currency" : "Transfer issued tokens",
        network, wallet: holder.toBase58(), sourceMint: source.toBase58(),
        destination: target.toBase58(), amount: amount + " tokens (six decimals)",
        details: "Source token account: " + sourceAccounts.issuedAccount.key.toBase58() + ". Test funds only.",
      },
      afterConfirmed: () => { setAmount(""); },
    };
  }

  return <article className="module operation-panel">
    <h2>Convert & transfer</h2>
    <p>Conversions require two verified Solo-X currencies with the same configured test collateral. Transfers use standard SPL Token transfer.</p>
    <form onSubmit={(event) => { event.preventDefault(); void flow.start(prepare); }}>
      <label>Action <select value={mode} onChange={(event) => setMode(event.target.value as Mode)} disabled={flow.blocked}><option value="convert">Convert compatible currency</option><option value="transfer">Transfer issued tokens</option></select></label>
      <label>Source issued mint <input required value={sourceMint} onChange={(event) => setSourceMint(event.target.value)} disabled={flow.blocked} /></label>
      <label>{mode === "convert" ? "Destination issued mint" : "Recipient token account"}<input required value={destination} onChange={(event) => setDestination(event.target.value)} disabled={flow.blocked} /></label>
      <label>Amount <input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={flow.blocked} /></label>
      <button className="wallet-button" disabled={flow.blocked}>{flow.busy ? "Working…" : "Review transaction"}</button>
    </form>
    {flow.review && <TransactionReview review={flow.review} onApprove={() => void flow.approve()} onCancel={flow.cancel} busy={flow.busy} />}
    {flow.pending && <p role="alert">Transaction {flow.pending} is unresolved. Do not retry.
      <button type="button" className="wallet-button secondary" disabled={flow.busy} onClick={() => void flow.recheck()}>Recheck on-chain status</button>
    </p>}
    {flow.message && <p role="status">{flow.message}</p>}
  </article>;
}
