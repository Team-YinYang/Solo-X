import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

describe("solo-x", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SoloX;
  const collateralMint = new anchor.web3.PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  );

  it("deploys and accepts the foundation instruction", async () => {
    const signature = await program.methods.initialize().rpc();
    const transaction = await provider.connection.getTransaction(signature, {
      commitment: "confirmed",
    });

    assert.isNotNull(transaction);
    assert.isNull(transaction?.meta?.err);
  });

  it("initializes independent zero-supply currencies and vaults", async () => {
    const createCurrency = async () => {
      const issuedMint = anchor.web3.Keypair.generate();
      const [currency] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("currency"), issuedMint.publicKey.toBuffer()],
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

      await program.methods
        .createCurrency()
        .accounts({
          creator: provider.wallet.publicKey,
          issuedMint: issuedMint.publicKey,
          currency,
          collateralMint,
          authority,
          collateralVault,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([issuedMint])
        .rpc();

      return { authority, collateralVault, currency, issuedMint: issuedMint.publicKey };
    };

    const first = await createCurrency();
    const second = await createCurrency();

    assert.notEqual(first.currency.toBase58(), second.currency.toBase58());
    assert.notEqual(first.collateralVault.toBase58(), second.collateralVault.toBase58());

    const [firstState, secondState] = await Promise.all([
      program.account.currencyState.fetch(first.currency),
      program.account.currencyState.fetch(second.currency),
    ]);
    assert.equal(firstState.issuedMint.toBase58(), first.issuedMint.toBase58());
    assert.equal(secondState.issuedMint.toBase58(), second.issuedMint.toBase58());
    assert.equal(firstState.collateralVault.toBase58(), first.collateralVault.toBase58());
    assert.equal(secondState.collateralVault.toBase58(), second.collateralVault.toBase58());

    for (const currency of [first, second]) {
      const mintAccount = await provider.connection.getAccountInfo(currency.issuedMint);
      assert.isNotNull(mintAccount);
      assert.equal(mintAccount?.owner.toBase58(), anchor.utils.token.TOKEN_PROGRAM_ID.toBase58());

      // SPL Token Mint layout: authority option (0), authority (4), supply (36),
      // decimals (44), initialized (45), freeze-authority option (46).
      const mintData = mintAccount!.data;
      assert.equal(mintData.readUInt32LE(0), 1);
      assert.equal(
        new anchor.web3.PublicKey(mintData.subarray(4, 36)).toBase58(),
        currency.authority.toBase58(),
      );
      assert.equal(mintData.readBigUInt64LE(36), 0n);
      assert.equal(mintData[44], 6);
      assert.equal(mintData.readUInt32LE(46), 0);
    }
  });
});
