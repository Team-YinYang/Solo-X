import * as anchor from "@coral-xyz/anchor";
import { assert } from "chai";

describe("solo-x", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SoloX;

  it("deploys and accepts the foundation instruction", async () => {
    const signature = await program.methods.initialize().rpc();
    const transaction = await provider.connection.getTransaction(signature, {
      commitment: "confirmed",
    });

    assert.isNotNull(transaction);
    assert.isNull(transaction?.meta?.err);
  });
});
