# Solo-X SDK: typed instructions and reserve reads (issue #9)

The SDK exposes **unsigned, typed Anchor instruction descriptors** for the MVP's four on-chain operations. It does not collect private keys, submit transactions, connect to a wallet, or custody funds. Caller-provided wallet / transaction libraries remain responsible for signing and sending.

**Networks:** local validator or devnet test tokens only. This code is not audited and is not authorized for mainnet or real funds.

## Exported helpers

| Helper | Purpose |
| --- | --- |
| deriveSoloXCurrencyAddresses(issuedMint, resolver) | Derive state, isolated vault and authority PDAs with a caller-supplied Solana PDA resolver. |
| buildCreateCurrency(accounts) | Create; creator wallet **and new issued mint keypair** must sign. |
| buildMintCurrency(accounts, amount) | Authorized collateral deposit / issuance; depositor signs. |
| buildRedeemCurrency(accounts, amount) | Holder burn / collateral redemption; holder signs. |
| buildConvertCurrency(accounts, amount) | Atomic burn / collateral transfer / mint; holder signs. |
| decodeSoloXCurrencyState(account) | Decode Anchor discriminator and versioned state. |
| readSoloXReserves(rpc, addresses) | Read actual SPL mint supply and isolated vault balance, surplus and backing status. |

Builders return a structure with programId, named accounts, ordered keys, instruction data and signers. The key list matches the Rust Anchor account order and signer/writable requirements. Data has the eight-byte Anchor instruction discriminator plus a little-endian u64 for operations with an amount. **Amounts must be positive bigints in six-decimal base units** (1_500_000n means 1.5 tokens); float and number inputs fail closed.

## PDA and transaction integration

Use your app's existing @solana/web3.js or Anchor dependency. The SDK has no additional wallet or runtime dependencies.

~~~ts
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  deriveSoloXCurrencyAddresses, buildCreateCurrency,
  SOLO_X_TEST_USDC_MINT, SOLO_X_TOKEN_PROGRAM_ID, SOLO_X_SYSTEM_PROGRAM_ID,
} from "@solo-x/sdk";

const issuedMintAddress = newMintKeypair.publicKey.toBase58(); // caller-created signer
const pdas = deriveSoloXCurrencyAddresses(issuedMintAddress, (seeds, programId) => {
  const [pda, bump] = PublicKey.findProgramAddressSync(
    seeds.map((seed) => Buffer.from(seed)), new PublicKey(programId),
  );
  return [pda.toBase58(), bump];
});
const desc = buildCreateCurrency({
  creator: wallet.publicKey.toBase58(),
  issuedMint: issuedMintAddress,
  currency: pdas.currency,
  collateralMint: SOLO_X_TEST_USDC_MINT,
  collateralVault: pdas.collateralVault,
  authority: pdas.authority,
  tokenProgram: SOLO_X_TOKEN_PROGRAM_ID,
  systemProgram: SOLO_X_SYSTEM_PROGRAM_ID,
});
const instruction = new TransactionInstruction({
  programId: new PublicKey(desc.programId),
  keys: desc.keys.map(({ pubkey, isSigner, isWritable }) => ({
    pubkey: new PublicKey(pubkey), isSigner, isWritable,
  })),
  data: Buffer.from(desc.data),
});
// Add to a transaction with blockhash and fee payer, sign with
// wallet AND newMintKeypair, then send from your application.
// The SDK never handles private keys or signatures.
~~~

For mint, redeem and convert, call the corresponding typed builder with all required accounts and a positive bigint amount. Create the caller/recipient SPL token accounts separately; these helpers build only the Solo-X program instruction.

## Reading reserves

~~~ts
import { PublicKey } from "@solana/web3.js";
import { readSoloXReserves } from "@solo-x/sdk";

const client = {
  async getAccountInfo(address: string) {
    const info = await connection.getAccountInfo(new PublicKey(address), "confirmed");
    return info ? { owner: info.owner.toBase58(), data: info.data } : null;
  },
};
const result = await readSoloXReserves(client, {
  currency: pdas.currency,
  issuedMint: issuedMintAddress,
  collateralVault: pdas.collateralVault,
});
// result.supply, result.reserves and result.surplus are bigint;
// result.backed is true exactly when reserves >= supply.
~~~

The read checks Anchor state discriminator/version, owner, issued mint authority/decimals, vault mint/owner, no delegate or close authority, allowed test-USDC collateral, and state-recorded mint/vault bindings. **The snapshot is advisory, not a trusted solvency oracle:** separate RPC reads can race with transactions. Independently derive and compare PDAs for stronger client-side assurance; on-chain Anchor constraints remain authoritative.

SoloXSdkError has a stable code: INVALID_ACCOUNT, INVALID_AMOUNT, UNSUPPORTED_COLLATERAL, INVALID_STATE or RPC_ERROR. Unexpected RPC failures retain their original cause; malformed accounts fail closed. All operations are unaudited and for local validator or devnet test assets only.

## Test commands

~~~bash
npm ci
npm run typecheck -w @solo-x/sdk
npm run build -w @solo-x/sdk
npm run test -w @solo-x/sdk
npm run lint -w @solo-x/sdk
~~~

Six automated SDK test cases cover discriminators, signer/writable flags, endian encoding, u64 boundaries, invalid inputs, PDA seed groups, reserve/deficit reads, malformed state, delegated vaults and RPC errors. An end-to-end local-validator workflow is still required before deployment or real use.
