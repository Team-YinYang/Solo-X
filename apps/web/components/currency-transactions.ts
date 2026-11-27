import { verifyCurrency } from "./currency-identity";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";

const PROGRAM = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const COLLATERAL = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export type Operation = "mint" | "redeem";

export async function verifiedConnection() {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const url = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  if (network !== "devnet" && network !== "localnet") throw new Error("Test networks only.");
  if (network === "localnet" && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Local validator must use a loopback RPC.");
  const connection = new Connection(url, "confirmed");
  const genesis = await connection.getGenesisHash();
  if (network === "devnet" && genesis !== "EtWTRABZaYq6iMfeYKouRu166VU2xqa1") throw new Error("Wrong network.");
  return connection;
}

export async function loadAccounts(connection: Connection, holder: PublicKey, issued: PublicKey) {
  const { currency, vault, authority } = await verifyCurrency(connection, issued);
  async function find(mint: PublicKey) {
    const accounts = await connection.getTokenAccountsByOwner(holder, { mint });
    const valid = accounts.value.filter(({account}) => account.owner.equals(TOKEN) && account.data.length === 165 && account.data[108] === 1);
    valid.sort((a,b) => { const x=a.account.data.readBigUInt64LE(64), y=b.account.data.readBigUInt64LE(64); return x>y?-1:x<y?1:0; });
    const first = valid[0];
    if (!first) throw new Error("Create an initialized token account for " + mint.toBase58() + " first.");
    return { key: first.pubkey, balance: first.account.data.readBigUInt64LE(64) };
  }
  const [issuedAccount, collateralAccount] = await Promise.all([find(issued), find(COLLATERAL)]);
  return { currency, vault, authority, issued, issuedAccount, collateralAccount };
}

export async function buildTransaction(connection: Connection, holder: PublicKey, issued: PublicKey, operation: Operation, amount: bigint) {
  const a = await loadAccounts(connection, holder, issued);
  const source = operation === "mint" ? a.collateralAccount : a.issuedAccount;
  const destination = operation === "mint" ? a.issuedAccount : a.collateralAccount;
  if (amount <= 0n || amount > source.balance) throw new Error("Insufficient available token balance.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("global:" + operation + "_currency"));
  const data = Buffer.alloc(16);
  Buffer.from(digest).copy(data, 0, 0, 8);
  data.writeBigUInt64LE(amount, 8);
  const keys = [holder, a.currency, issued, COLLATERAL, source.key, destination.key, a.vault, a.authority, TOKEN].map((pubkey,i) => ({pubkey, isSigner:i===0, isWritable:[0,2,4,5,6].includes(i)}));
  const block = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({feePayer:holder, blockhash:block.blockhash, lastValidBlockHeight:block.lastValidBlockHeight}).add(new TransactionInstruction({programId:PROGRAM, keys, data}));
  return {transaction, block};
}
