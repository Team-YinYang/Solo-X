import { Connection, PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

const PROGRAM = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const COLLATERAL = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export async function verifyCurrency(connection: Connection, issued: PublicKey) {
  const [currency, sb] = PublicKey.findProgramAddressSync([Buffer.from("currency"),issued.toBuffer()],PROGRAM);
  const [vault, vb] = PublicKey.findProgramAddressSync([Buffer.from("vault"),currency.toBuffer()],PROGRAM);
  const [authority, ab] = PublicKey.findProgramAddressSync([Buffer.from("authority"),currency.toBuffer()],PROGRAM);
  const [state,mint,reserve,collateral] = await connection.getMultipleAccountsInfo([currency,issued,vault,COLLATERAL]);
  const discriminator = new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode("account:CurrencyState"))).subarray(0,8);
  const key = (data: Buffer, offset: number, expected: PublicKey) => new PublicKey(data.subarray(offset,offset+32)).equals(expected);
  if (issued.equals(COLLATERAL) || !state || !state.owner.equals(PROGRAM) || state.data.length!==172 ||
    !state.data.subarray(0,8).equals(Buffer.from(discriminator)) || state.data[8]!==1 ||
    !key(state.data,41,issued) || !key(state.data,73,COLLATERAL) || !key(state.data,105,vault) || !key(state.data,137,authority) ||
    state.data[169]!==sb || state.data[170]!==vb || state.data[171]!==ab ||
    !mint || !mint.owner.equals(TOKEN) || mint.data.length!==82 || mint.data.readUInt32LE(0)!==1 ||
    !key(mint.data,4,authority) || mint.data[44]!==6 || mint.data[45]!==1 || mint.data.readUInt32LE(46)!==0 ||
    !collateral || !collateral.owner.equals(TOKEN) || collateral.data.length!==82 || collateral.data[44]!==6 || collateral.data[45]!==1 ||
    !reserve || !reserve.owner.equals(TOKEN) || reserve.data.length!==165 || !key(reserve.data,0,COLLATERAL) ||
    !key(reserve.data,32,authority) || reserve.data.readUInt32LE(72)!==0 || reserve.data[108]!==1 ||
    reserve.data.readUInt32LE(109)!==0 || reserve.data.readUInt32LE(129)!==0 ||
    reserve.data.readBigUInt64LE(64)<mint.data.readBigUInt64LE(36)) throw new Error("Currency identity or reserves could not be verified.");
  return {currency,vault,authority,issued};
}
export async function discoverCurrencies(connection: Connection) {
  const accounts = await connection.getProgramAccounts(PROGRAM,{filters:[{dataSize:172}]});
  const verified: Awaited<ReturnType<typeof verifyCurrency>>[] = [];
  for (const account of accounts) {
    try {
      const item = await verifyCurrency(connection,new PublicKey(account.account.data.subarray(41,73)));
      if(item.currency.equals(account.pubkey)) verified.push(item);
    } catch { /* Unverified candidates never qualify. */ }
  }
  return verified;
}
