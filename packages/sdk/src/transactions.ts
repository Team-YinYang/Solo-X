/** Non-custodial, dependency-free instruction descriptions for Solo-X Anchor. */
export const SOLO_X_DECIMALS = 6;
export const SOLO_X_PROGRAM_ID = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";
export const SOLO_X_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const SOLO_X_SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
export const SOLO_X_TEST_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const MAX_U64 = (1n << 64n) - 1n;

export type SoloXInstructionName = "createCurrency" | "mintCurrency" | "redeemCurrency" | "convertCurrency";
export type SoloXAccountMap<T extends string> = Readonly<Record<T, string>>;
export type SoloXAccountMeta = Readonly<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
export type SoloXInstruction<T extends string = string> = Readonly<{
  name: SoloXInstructionName;
  programId: string;
  /** Named accounts retain Anchor's canonical instruction order. */
  accounts: SoloXAccountMap<T>;
  /** Keys are ready to map into a web3.js TransactionInstruction. */
  keys: readonly SoloXAccountMeta[];
  /** Eight-byte Anchor discriminator and optional little-endian u64 amount. */
  data: Uint8Array;
  /** External signatures are supplied by the caller's wallet, never by this SDK. */
  signers: readonly string[];
}>;

export type CreateCurrencyAccounts = "creator" | "issuedMint" | "currency" | "collateralMint" | "authority" | "collateralVault" | "tokenProgram" | "systemProgram";
export type MintCurrencyAccounts = "depositor" | "currency" | "issuedMint" | "collateralMint" | "depositorCollateralTokens" | "recipientIssuedTokens" | "collateralVault" | "authority" | "tokenProgram";
export type RedeemCurrencyAccounts = "holder" | "currency" | "issuedMint" | "collateralMint" | "holderIssuedTokens" | "holderCollateralTokens" | "collateralVault" | "authority" | "tokenProgram";
export type ConvertCurrencyAccounts = "holder" | "source" | "destination" | "sourceMint" | "destinationMint" | "collateralMint" | "sourceVault" | "destinationVault" | "sourceAuthority" | "destinationAuthority" | "sourceTokens" | "destinationTokens" | "tokenProgram";

export interface BuildSoloXOptions { readonly programId?: string }

export class SoloXSdkError extends Error {
  constructor(public readonly code: "INVALID_ACCOUNT" | "INVALID_AMOUNT" | "UNSUPPORTED_COLLATERAL" | "RPC_ERROR" | "INVALID_STATE", message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SoloXSdkError";
  }
}

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function decodeAddress(address: string): Uint8Array {
  if (typeof address !== "string" || !address || address.trim() !== address || address.length > 44) throw new SoloXSdkError("INVALID_ACCOUNT", "Invalid Solana public key");
  let n = 0n;
  for (const char of address) {
    const digit = ALPHABET.indexOf(char);
    if (digit < 0) throw new SoloXSdkError("INVALID_ACCOUNT", "Invalid base58 Solana public key");
    n = n * 58n + BigInt(digit);
  }
  const bytes = new Uint8Array(32);
  for (let index = 31; index >= 0; index--) {
    bytes[index] = Number(n & 255n);
    n >>= 8n;
  }
  if (n !== 0n) throw new SoloXSdkError("INVALID_ACCOUNT", "Solana public key exceeds 32 bytes");
  const leading = address.match(/^1*/)?.[0].length ?? 0;
  if (leading > 32 || bytes.slice(0, leading).some((byte) => byte !== 0)) throw new SoloXSdkError("INVALID_ACCOUNT", "Invalid Solana public key length");
  if (encodeAddress(bytes) !== address) throw new SoloXSdkError("INVALID_ACCOUNT", "Non-canonical Solana public key");
  return bytes;
}
function encodeAddress(bytes: Uint8Array): string {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) + BigInt(b);
  let result = "";
  while (n > 0n) { result = ALPHABET[Number(n % 58n)] + result; n /= 58n; }
  let leading = 0;
  while (leading < bytes.length && bytes[leading] === 0) leading++;
  return "1".repeat(leading) + result;
}
function account(accounts: Record<string, string>, name: string): string {
  const value = accounts[name];
  decodeAddress(value);
  return value;
}

/** Adapts Solana web3.js findProgramAddressSync without bundling wallet or RPC dependencies. */
export type SoloXPdaResolver = (seeds: readonly Uint8Array[], programId: string) => readonly [address: string, bump: number];
export interface SoloXCurrencyAddresses {
  readonly currency: string;
  readonly collateralVault: string;
  readonly authority: string;
  readonly stateBump: number;
  readonly vaultBump: number;
  readonly authorityBump: number;
}
export function deriveSoloXCurrencyAddresses(issuedMint: string, resolver: SoloXPdaResolver, options: BuildSoloXOptions = {}): SoloXCurrencyAddresses {
  const programId = options.programId ?? SOLO_X_PROGRAM_ID;
  decodeAddress(programId);
  const mintBytes = decodeAddress(issuedMint);
  const seed = (s: string) => new TextEncoder().encode(s);
  const resolve = (seeds: readonly Uint8Array[]): readonly [string, number] => {
    const result = resolver(seeds, programId);
    decodeAddress(result[0]);
    if (!Number.isInteger(result[1]) || result[1] < 0 || result[1] > 255) {
      throw new SoloXSdkError("INVALID_ACCOUNT", "Invalid PDA bump returned by resolver");
    }
    return result;
  };
  const [currency, stateBump] = resolve([seed("currency"), mintBytes]);
  const [collateralVault, vaultBump] = resolve([seed("vault"), decodeAddress(currency)]);
  const [authority, authorityBump] = resolve([seed("authority"), decodeAddress(currency)]);
  return Object.freeze({ currency, collateralVault, authority, stateBump, vaultBump, authorityBump });
}

export function parseSoloXAmount(amount: bigint): bigint {
  if (typeof amount !== "bigint" || amount <= 0n || amount > MAX_U64) throw new SoloXSdkError("INVALID_AMOUNT", "Amount must be a positive u64 bigint in six-decimal base units");
  return amount;
}
const DISCRIMINATORS: Record<SoloXInstructionName, readonly number[]> = {
  createCurrency: [148, 249, 90, 34, 172, 92, 48, 196],
  mintCurrency: [118, 52, 121, 137, 250, 38, 117, 62],
  redeemCurrency: [132, 25, 8, 134, 204, 179, 156, 159],
  convertCurrency: [89, 185, 237, 218, 23, 6, 98, 250],
};
function instructionData(name: SoloXInstructionName, amount?: bigint): Uint8Array {
  const bytes = new Uint8Array(amount === undefined ? 8 : 16);
  bytes.set(DISCRIMINATORS[name]);
  if (amount !== undefined) new DataView(bytes.buffer).setBigUint64(8, parseSoloXAmount(amount), true);
  return bytes;
}
function checkTokenPrograms(accounts: { readonly tokenProgram: string; readonly systemProgram?: string }): void {
  if (accounts.tokenProgram !== SOLO_X_TOKEN_PROGRAM_ID || (accounts.systemProgram !== undefined && accounts.systemProgram !== SOLO_X_SYSTEM_PROGRAM_ID)) {
    throw new SoloXSdkError("INVALID_ACCOUNT", "Solo-X requires standard SPL Token and Solana system programs");
  }
}
function checkCollateral(accounts: { readonly collateralMint: string }): void {
  if (accounts.collateralMint !== SOLO_X_TEST_USDC_MINT) throw new SoloXSdkError("UNSUPPORTED_COLLATERAL", "MVP supports only the configured devnet test-USDC mint");
}
function build<T extends string>(name: SoloXInstructionName, accounts: SoloXAccountMap<T>, order: readonly T[], signerKeys: readonly T[], writableKeys: readonly T[], amount?: bigint, options: BuildSoloXOptions = {}): SoloXInstruction<T> {
  const data = instructionData(name, amount);
  const programId = options.programId ?? SOLO_X_PROGRAM_ID;
  decodeAddress(programId);
  const named = {} as Record<T, string>;
  const keys = order.map((name) => {
    named[name] = account(accounts, name);
    return Object.freeze({ pubkey: named[name], isSigner: signerKeys.includes(name), isWritable: writableKeys.includes(name) });
  });
  return Object.freeze({ name, programId, accounts: Object.freeze(named), keys: Object.freeze(keys), data, signers: Object.freeze(signerKeys.map((name) => named[name])) });
}
export function buildCreateCurrency(accounts: SoloXAccountMap<CreateCurrencyAccounts>, options: BuildSoloXOptions = {}): SoloXInstruction<CreateCurrencyAccounts> {
  checkTokenPrograms(accounts); checkCollateral(accounts);
  if (accounts.issuedMint === accounts.collateralMint) throw new SoloXSdkError("INVALID_ACCOUNT", "Issued mint must differ from collateral mint");
  return build("createCurrency", accounts,
    ["creator", "issuedMint", "currency", "collateralMint", "authority", "collateralVault", "tokenProgram", "systemProgram"],
    ["creator", "issuedMint"], ["creator", "issuedMint", "currency", "collateralVault"], undefined, options);
}
export function buildMintCurrency(accounts: SoloXAccountMap<MintCurrencyAccounts>, amount: bigint, options: BuildSoloXOptions = {}): SoloXInstruction<MintCurrencyAccounts> {
  checkTokenPrograms(accounts); checkCollateral(accounts);
  return build("mintCurrency", accounts,
    ["depositor", "currency", "issuedMint", "collateralMint", "depositorCollateralTokens", "recipientIssuedTokens", "collateralVault", "authority", "tokenProgram"],
    ["depositor"], ["depositor", "issuedMint", "depositorCollateralTokens", "recipientIssuedTokens", "collateralVault"], amount, options);
}
export function buildRedeemCurrency(accounts: SoloXAccountMap<RedeemCurrencyAccounts>, amount: bigint, options: BuildSoloXOptions = {}): SoloXInstruction<RedeemCurrencyAccounts> {
  checkTokenPrograms(accounts); checkCollateral(accounts);
  return build("redeemCurrency", accounts,
    ["holder", "currency", "issuedMint", "collateralMint", "holderIssuedTokens", "holderCollateralTokens", "collateralVault", "authority", "tokenProgram"],
    ["holder"], ["issuedMint", "holderIssuedTokens", "holderCollateralTokens", "collateralVault"], amount, options);
}
export function buildConvertCurrency(accounts: SoloXAccountMap<ConvertCurrencyAccounts>, amount: bigint, options: BuildSoloXOptions = {}): SoloXInstruction<ConvertCurrencyAccounts> {
  checkTokenPrograms(accounts); checkCollateral(accounts);
  if (accounts.source === accounts.destination || accounts.sourceMint === accounts.destinationMint || accounts.sourceVault === accounts.destinationVault) {
    throw new SoloXSdkError("INVALID_ACCOUNT", "Conversion requires distinct currencies, mints and vaults");
  }
  return build("convertCurrency", accounts,
    ["holder", "source", "destination", "sourceMint", "destinationMint", "collateralMint", "sourceVault", "destinationVault", "sourceAuthority", "destinationAuthority", "sourceTokens", "destinationTokens", "tokenProgram"],
    ["holder"], ["sourceMint", "destinationMint", "sourceVault", "destinationVault", "sourceTokens", "destinationTokens"], amount, options);
}

/** Minimal read-only adapter: wrap a web3.js Connection to return { owner: owner.toBase58(), data }. */
export interface SoloXRpcAccount { readonly owner: string; readonly data: Uint8Array }
export interface SoloXReadClient { getAccountInfo(address: string): Promise<SoloXRpcAccount | null> }
export interface SoloXCurrencyState {
  readonly version: number;
  readonly creator: string;
  readonly issuedMint: string;
  readonly collateralMint: string;
  readonly collateralVault: string;
  readonly authority: string;
  readonly stateBump: number;
  readonly vaultBump: number;
  readonly authorityBump: number;
}
export interface SoloXReserveSnapshot {
  readonly currency: string;
  readonly state: SoloXCurrencyState;
  readonly supply: bigint;
  readonly reserves: bigint;
  readonly surplus: bigint;
  readonly backed: boolean;
}
const STATE_DISCRIMINATOR = [31, 72, 75, 245, 227, 75, 61, 42];
function invalid(message: string): never { throw new SoloXSdkError("INVALID_STATE", message); }
function isEqual(a: Uint8Array, b: Uint8Array): boolean { return a.length === b.length && a.every((byte, i) => byte === b[i]); }
function requiredData(account: SoloXRpcAccount | null, owner: string, length: number, label: string): Uint8Array {
  if (!account) return invalid(label + " account was not found");
  if (account.owner !== owner || account.data.length < length) return invalid("Invalid " + label + " account owner or layout");
  return account.data;
}
function keyAt(bytes: Uint8Array, offset: number): string { return encodeAddress(bytes.subarray(offset, offset + 32)); }
export function decodeSoloXCurrencyState(account: SoloXRpcAccount | null, programId: string = SOLO_X_PROGRAM_ID): SoloXCurrencyState {
  decodeAddress(programId);
  const data = requiredData(account, programId, 172, "Currency state");
  if (!isEqual(data.subarray(0, 8), Uint8Array.from(STATE_DISCRIMINATOR)) || data[8] !== 1) return invalid("Unexpected currency state discriminator or version");
  return Object.freeze({
    version: data[8], creator: keyAt(data, 9), issuedMint: keyAt(data, 41), collateralMint: keyAt(data, 73),
    collateralVault: keyAt(data, 105), authority: keyAt(data, 137),
    stateBump: data[169], vaultBump: data[170], authorityBump: data[171],
  });
}
export async function readSoloXReserves(client: SoloXReadClient, addresses: { readonly currency: string; readonly issuedMint: string; readonly collateralVault: string }, options: BuildSoloXOptions = {}): Promise<SoloXReserveSnapshot> {
  for (const value of Object.values(addresses)) decodeAddress(value);
  const programId = options.programId ?? SOLO_X_PROGRAM_ID;
  decodeAddress(programId);
  let currencyAccount: SoloXRpcAccount | null, mintAccount: SoloXRpcAccount | null, vaultAccount: SoloXRpcAccount | null;
  try {
    [currencyAccount, mintAccount, vaultAccount] = await Promise.all([
      client.getAccountInfo(addresses.currency), client.getAccountInfo(addresses.issuedMint), client.getAccountInfo(addresses.collateralVault),
    ]);
  } catch (error) {
    throw new SoloXSdkError("RPC_ERROR", "Failed to read Solo-X accounts from RPC", { cause: error });
  }
  const state = decodeSoloXCurrencyState(currencyAccount, programId);
  const mint = requiredData(mintAccount, SOLO_X_TOKEN_PROGRAM_ID, 82, "Issued mint");
  const vault = requiredData(vaultAccount, SOLO_X_TOKEN_PROGRAM_ID, 165, "Collateral vault");
  if (state.issuedMint !== addresses.issuedMint || state.collateralVault !== addresses.collateralVault || state.collateralMint !== SOLO_X_TEST_USDC_MINT) return invalid("Currency state address bindings or collateral mint mismatch");
  if (mint[44] !== SOLO_X_DECIMALS || mint[45] !== 1 || new DataView(mint.buffer, mint.byteOffset).getUint32(0, true) !== 1 || keyAt(mint, 4) !== state.authority || new DataView(mint.buffer, mint.byteOffset).getUint32(46, true) !== 0) return invalid("Issued mint authority, decimals or freeze settings are invalid");
  const vaultView = new DataView(vault.buffer, vault.byteOffset);
  if (keyAt(vault, 0) !== state.collateralMint || keyAt(vault, 32) !== state.authority || vault[108] !== 1 || vaultView.getUint32(72, true) !== 0 || vaultView.getUint32(129, true) !== 0) return invalid("Collateral vault mint, authority, delegate or close authority mismatch");
  const supply = new DataView(mint.buffer, mint.byteOffset).getBigUint64(36, true);
  const reserves = vaultView.getBigUint64(64, true);
  return Object.freeze({ currency: addresses.currency, state, supply, reserves, surplus: reserves >= supply ? reserves - supply : 0n, backed: reserves >= supply });
}
