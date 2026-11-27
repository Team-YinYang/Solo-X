import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCreateCurrency, buildMintCurrency, buildRedeemCurrency, buildConvertCurrency, deriveSoloXCurrencyAddresses,
  decodeSoloXCurrencyState, readSoloXReserves, parseSoloXAmount, SoloXSdkError,
  MAX_U64, SOLO_X_PROGRAM_ID, SOLO_X_TOKEN_PROGRAM_ID, SOLO_X_TEST_USDC_MINT,
  SOLO_X_SYSTEM_PROGRAM_ID,
} from "./transactions.js";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function encode(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  let result = "";
  while (n) { result = BASE58[Number(n % 58n)] + result; n /= 58n; }
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading++;
  return "1".repeat(leading) + result;
}
function decode(value: string): Uint8Array {
  let n = 0n;
  for (const c of value) n = n * 58n + BigInt(BASE58.indexOf(c));
  const bytes = new Uint8Array(32);
  for (let i=31; i>=0; i--) { bytes[i] = Number(n & 255n); n >>= 8n; }
  return bytes;
}
function key(byte: number): string { return encode(new Uint8Array(32).fill(byte)); }
const signer = key(1), issuedMint = key(2), currency = key(3), authority = key(4), vault = key(5), collateralFrom = key(6), issuedTo = key(7);
const create = { creator: signer, issuedMint, currency, collateralMint: SOLO_X_TEST_USDC_MINT, authority, collateralVault: vault, tokenProgram: SOLO_X_TOKEN_PROGRAM_ID, systemProgram: SOLO_X_SYSTEM_PROGRAM_ID };
const mint = { depositor: signer, currency, issuedMint, collateralMint: SOLO_X_TEST_USDC_MINT, depositorCollateralTokens: collateralFrom, recipientIssuedTokens: issuedTo, collateralVault: vault, authority, tokenProgram: SOLO_X_TOKEN_PROGRAM_ID };
const redeem = { holder: signer, currency, issuedMint, collateralMint: SOLO_X_TEST_USDC_MINT, holderIssuedTokens: issuedTo, holderCollateralTokens: collateralFrom, collateralVault: vault, authority, tokenProgram: SOLO_X_TOKEN_PROGRAM_ID };
const convert = { holder: signer, source: currency, destination: key(8), sourceMint: issuedMint, destinationMint: key(9), collateralMint: SOLO_X_TEST_USDC_MINT, sourceVault: vault, destinationVault: key(10), sourceAuthority: authority, destinationAuthority: key(11), sourceTokens: issuedTo, destinationTokens: key(12), tokenProgram: SOLO_X_TOKEN_PROGRAM_ID };

function expectCode(fn: () => unknown, code: string): void {
  assert.throws(fn, (e: unknown) => e instanceof SoloXSdkError && e.code === code);
}
test("create instruction uses Anchor discriminator, exact account order and wallet/new-mint signers", () => {
  const i = buildCreateCurrency(create);
  assert.deepEqual([...i.data], [148,249,90,34,172,92,48,196]);
  assert.deepEqual(i.keys.map(k => k.pubkey), Object.values(create));
  assert.deepEqual(i.signers, [signer, issuedMint]);
  assert.deepEqual(i.keys.filter(k => k.isWritable).map(k => k.pubkey), [signer, issuedMint, currency, vault]);
  assert.equal(i.programId, SOLO_X_PROGRAM_ID);
  assert.equal("privateKey" in i, false);
});
test("mint, redeem and convert use encoded positive u64, required signers and canonical accounts", () => {
  for (const i of [buildMintCurrency(mint, 99n), buildRedeemCurrency(redeem, 99n), buildConvertCurrency(convert, 99n)]) {
    assert.equal(i.data.length, 16);
    assert.equal(new DataView(i.data.buffer).getBigUint64(8, true), 99n);
    assert.deepEqual(i.signers, [signer]);
    assert.equal(i.keys.length, Object.keys(i.accounts).length);
  }
  assert.deepEqual([...buildMintCurrency(mint, 1n).data.subarray(0,8)], [118,52,121,137,250,38,117,62]);
  assert.deepEqual([...buildRedeemCurrency(redeem, 1n).data.subarray(0,8)], [132,25,8,134,204,179,156,159]);
  assert.deepEqual([...buildConvertCurrency(convert, 1n).data.subarray(0,8)], [89,185,237,218,23,6,98,250]);
  assert.equal(buildMintCurrency(mint,1n).keys[0].isWritable, true);
});
test("invalid amount, account, unsupported collateral and same-currency conversion fail closed", () => {
  for (const v of [0n,-1n,MAX_U64+1n]) expectCode(() => parseSoloXAmount(v), "INVALID_AMOUNT");
  assert.equal(parseSoloXAmount(MAX_U64),MAX_U64);
  expectCode(() => buildMintCurrency(mint, 1 as never), "INVALID_AMOUNT");
  expectCode(() => buildCreateCurrency({ ...create, issuedMint: "bogus" }), "INVALID_ACCOUNT");
  expectCode(() => buildCreateCurrency({ ...create, issuedMint: SOLO_X_TEST_USDC_MINT }), "INVALID_ACCOUNT");
  expectCode(() => buildCreateCurrency({ ...create, collateralMint: issuedMint }), "UNSUPPORTED_COLLATERAL");
  expectCode(() => buildMintCurrency({ ...mint, tokenProgram: signer }, 1n), "INVALID_ACCOUNT");
  expectCode(() => buildRedeemCurrency({ ...redeem, collateralMint: signer }, 1n), "UNSUPPORTED_COLLATERAL");
  expectCode(() => buildConvertCurrency({ ...convert, destination: currency }, 1n), "INVALID_ACCOUNT");
});

function fixture(supply: bigint, reserves: bigint) {
  const state = new Uint8Array(172);
  state.set([31,72,75,245,227,75,61,42]); state[8]=1;
  state.set(decode(signer),9); state.set(decode(issuedMint),41); state.set(decode(SOLO_X_TEST_USDC_MINT),73);
  state.set(decode(vault),105); state.set(decode(authority),137); state.set([1,2,3],169);
  const mintData = new Uint8Array(82); const mintView = new DataView(mintData.buffer);
  mintView.setUint32(0,1,true); mintData.set(decode(authority),4); mintView.setBigUint64(36,supply,true);mintData[44]=6;mintData[45]=1;
  const vaultData = new Uint8Array(165); const vaultView = new DataView(vaultData.buffer);
  vaultData.set(decode(SOLO_X_TEST_USDC_MINT),0);vaultData.set(decode(authority),32);
  vaultView.setBigUint64(64,reserves,true);vaultData[108]=1;
  const rpc = { getAccountInfo: async (key: string) => {
    if (key === currency) return { owner: SOLO_X_PROGRAM_ID, data: state };
    if (key === issuedMint) return { owner: SOLO_X_TOKEN_PROGRAM_ID, data: mintData };
    if (key === vault) return { owner: SOLO_X_TOKEN_PROGRAM_ID, data: vaultData };
    return null;
  }};
  return { state, mintData, vaultData, rpc };
}
test("PDA helper supplies canonical seed groups to a caller-provided web3 resolver", () => {
  const calls: string[] = [];
  const derived = deriveSoloXCurrencyAddresses(issuedMint, (seeds, programId) => {
    assert.equal(programId, SOLO_X_PROGRAM_ID);
    calls.push(new TextDecoder().decode(seeds[0]));
    return [calls.length === 1 ? currency : calls.length === 2 ? vault : authority, calls.length] as const;
  });
  assert.deepEqual(calls, ["currency", "vault", "authority"]);
  assert.deepEqual([derived.currency,derived.collateralVault,derived.authority], [currency,vault,authority]);
  assert.equal(derived.authorityBump,3);
  expectCode(() => deriveSoloXCurrencyAddresses(issuedMint, () => [currency, 999]), "INVALID_ACCOUNT");
});
test("reserve read returns actual SPL supply/vault balances and identifies deficits", async () => {
  const {rpc} = fixture(300n,350n);
  const result = await readSoloXReserves(rpc,{currency,issuedMint,collateralVault:vault});
  assert.deepEqual([result.supply,result.reserves,result.surplus,result.backed],[300n,350n,50n,true]);
  assert.equal(result.state.authority,authority);
  const deficit = await readSoloXReserves(fixture(300n,299n).rpc,{currency,issuedMint,collateralVault:vault});
  assert.deepEqual([deficit.backed,deficit.surplus],[false,0n]);
});
test("reserve read rejects substitution, corrupt state, delegated vault, invalid mint and RPC errors", async () => {
  const a = fixture(1n,2n);
  assert.throws(() => decodeSoloXCurrencyState({owner:signer,data:a.state}),/Invalid Currency state/);
  a.state[8]=2;
  await assert.rejects(() => readSoloXReserves(a.rpc,{currency,issuedMint,collateralVault:vault}),/Unexpected currency state/);
  const b = fixture(1n,2n);new DataView(b.vaultData.buffer).setUint32(72,1,true);
  await assert.rejects(() => readSoloXReserves(b.rpc,{currency,issuedMint,collateralVault:vault}),/Collateral vault/);
  const c = fixture(1n,2n);c.mintData[44]=9;
  await assert.rejects(() => readSoloXReserves(c.rpc,{currency,issuedMint,collateralVault:vault}),/Issued mint/);
  await assert.rejects(() => readSoloXReserves(fixture(1n,2n).rpc,{currency,issuedMint,collateralVault:key(25)}),/Collateral vault account was not found/);
  await assert.rejects(() => readSoloXReserves({getAccountInfo:async()=>{throw new Error("network down")}}, {currency,issuedMint,collateralVault:vault}), (e: unknown) => e instanceof SoloXSdkError && e.code==="RPC_ERROR");
});
