import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

describe("Solo-X adversarial security (#15) [local validator]", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.SoloX;
  const tokenProgram = anchor.utils.token.TOKEN_PROGRAM_ID;
  const collateralMint = new anchor.web3.PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  );

  function addresses(issuedMint: anchor.web3.PublicKey) {
    const [currency] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("currency"), issuedMint.toBuffer()],
      program.programId,
    );
    const [authority] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), currency.toBuffer()],
      program.programId,
    );
    const [collateralVault] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), currency.toBuffer()],
      program.programId,
    );
    return { currency, authority, collateralVault };
  }

  async function createCurrency() {
    const issuedMint = anchor.web3.Keypair.generate();
    const accounts = {
      creator: provider.wallet.publicKey,
      issuedMint: issuedMint.publicKey,
      collateralMint,
      ...addresses(issuedMint.publicKey),
      tokenProgram,
      systemProgram: anchor.web3.SystemProgram.programId,
    };
    await program.methods.createCurrency().accounts(accounts).signers([issuedMint]).rpc();
    return { issuedMint, accounts };
  }

  async function snapshot(issuedMint: anchor.web3.PublicKey) {
    const { currency, collateralVault } = addresses(issuedMint);
    const [mint, state, vault] = await Promise.all([
      provider.connection.getAccountInfo(issuedMint),
      provider.connection.getAccountInfo(currency),
      provider.connection.getAccountInfo(collateralVault),
    ]);
    return [mint, state, vault].map((x) =>
      x ? { owner: x.owner.toBase58(), lamports: x.lamports, data: x.data.toString("hex") } : null,
    );
  }

  async function expectRejection(action: () => Promise<unknown>) {
    let rejected = false;
    try {
      await action();
    } catch {
      rejected = true;
    }
    assert.isTrue(rejected, "malicious instruction unexpectedly succeeded");
  }

  it("rejects a substituted vault and cannot overwrite another currency", async () => {
    const first = await createCurrency();
    const second = await createCurrency();
    const before = await snapshot(first.issuedMint.publicKey);
    await expectRejection(() =>
      program.methods
        .redeemCurrency(new anchor.BN(1))
        .accounts({
          holder: provider.wallet.publicKey,
          currency: first.accounts.currency,
          issuedMint: first.issuedMint.publicKey,
          collateralMint,
          holderIssuedTokens: first.accounts.collateralVault,
          holderCollateralTokens: first.accounts.collateralVault,
          collateralVault: second.accounts.collateralVault,
          authority: first.accounts.authority,
          tokenProgram,
        })
        .rpc(),
    );
    assert.deepEqual(await snapshot(first.issuedMint.publicKey), before);
  });

  it("rejects a forged PDA authority on redemption", async () => {
    const { issuedMint, accounts } = await createCurrency();
    const before = await snapshot(issuedMint.publicKey);
    await expectRejection(() =>
      program.methods
        .redeemCurrency(new anchor.BN(1))
        .accounts({
          holder: provider.wallet.publicKey,
          currency: accounts.currency,
          issuedMint: issuedMint.publicKey,
          collateralMint,
          holderIssuedTokens: accounts.collateralVault,
          holderCollateralTokens: accounts.collateralVault,
          collateralVault: accounts.collateralVault,
          authority: provider.wallet.publicKey,
          tokenProgram,
        })
        .rpc(),
    );
    assert.deepEqual(await snapshot(issuedMint.publicKey), before);
  });

  it("rejects wrong collateral mint and creates no currency accounts", async () => {
    const issuedMint = anchor.web3.Keypair.generate();
    const before = await snapshot(issuedMint.publicKey);
    await expectRejection(() =>
      program.methods
        .createCurrency()
        .accounts({
          creator: provider.wallet.publicKey,
          issuedMint: issuedMint.publicKey,
          collateralMint: anchor.web3.SystemProgram.programId,
          ...addresses(issuedMint.publicKey),
          tokenProgram,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([issuedMint])
        .rpc(),
    );
    assert.deepEqual(await snapshot(issuedMint.publicKey), before);
  });

  it("rejects direct minting by an unauthorized external signer", async () => {
    const { issuedMint, accounts } = await createCurrency();
    // SPL Token MintTo opcode = 7; even a correctly initialized recipient
    // cannot authorize this PDA-controlled mint with an external wallet.
    const recipient = anchor.web3.Keypair.generate();
    const rent = await provider.connection.getMinimumBalanceForRentExemption(165);
    const account = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: recipient.publicKey,
        lamports: rent,
        space: 165,
        programId: tokenProgram,
      }),
      new anchor.web3.TransactionInstruction({
        programId: tokenProgram,
        keys: [
          { pubkey: recipient.publicKey, isSigner: false, isWritable: true },
          { pubkey: issuedMint.publicKey, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from([18]), provider.wallet.publicKey.toBuffer()]),
      }),
    );
    await provider.sendAndConfirm(account, [recipient]);
    const before = await snapshot(issuedMint.publicKey);
    const amount = Buffer.alloc(8);
    amount.writeBigUInt64LE(1n);
    const unauthorizedMint = new anchor.web3.TransactionInstruction({
      programId: tokenProgram,
      keys: [
        { pubkey: issuedMint.publicKey, isSigner: false, isWritable: true },
        { pubkey: recipient.publicKey, isSigner: false, isWritable: true },
        { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.concat([Buffer.from([7]), amount]),
    });
    await expectRejection(() =>
      provider.sendAndConfirm(new anchor.web3.Transaction().add(unauthorizedMint)),
    );
    assert.deepEqual(await snapshot(issuedMint.publicKey), before);
  });

  it("rolls back a successful first CPI-like create when later instruction fails", async () => {
    const issuedMint = anchor.web3.Keypair.generate();
    const accounts = {
      creator: provider.wallet.publicKey,
      issuedMint: issuedMint.publicKey,
      collateralMint,
      ...addresses(issuedMint.publicKey),
      tokenProgram,
      systemProgram: anchor.web3.SystemProgram.programId,
    };
    const before = await snapshot(issuedMint.publicKey);
    const create = await program.methods.createCurrency().accounts(accounts).instruction();
    // Second create must fail because the PDA and mint are already initialized.
    // The first create therefore must also be undone by Solana transaction atomicity.
    await expectRejection(() =>
      provider.sendAndConfirm(
        new anchor.web3.Transaction().add(create, create),
        [issuedMint],
      ),
    );
    assert.deepEqual(await snapshot(issuedMint.publicKey), before);
  });

  it("never accepts zero-value redemption and preserves reserves", async () => {
    const { issuedMint, accounts } = await createCurrency();
    const before = await snapshot(issuedMint.publicKey);
    await expectRejection(() =>
      program.methods
        .redeemCurrency(new anchor.BN(0))
        .accounts({
          holder: provider.wallet.publicKey,
          currency: accounts.currency,
          issuedMint: issuedMint.publicKey,
          collateralMint,
          holderIssuedTokens: accounts.collateralVault,
          holderCollateralTokens: accounts.collateralVault,
          collateralVault: accounts.collateralVault,
          authority: accounts.authority,
          tokenProgram,
        })
        .rpc(),
    );
    assert.deepEqual(await snapshot(issuedMint.publicKey), before);
  });
});
