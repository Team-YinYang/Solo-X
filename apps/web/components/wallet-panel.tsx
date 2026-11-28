"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function WalletPanel() {
  const { connected, connecting, disconnecting, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [message, setMessage] = useState("");
  const fullAddress = publicKey?.toBase58() ?? null;
  const addressPrefix = fullAddress?.slice(0, 4);

  async function disconnectWallet() {
    setMessage("");
    try {
      await disconnect();
    } catch {
      setMessage("The wallet could not be disconnected. Please try again.");
    }
  }

  if (connected && fullAddress && addressPrefix) {
    return (
      <div className="wallet-control">
        <span
          className="wallet-address"
          title={fullAddress}
          aria-label={`Connected wallet ${fullAddress}`}
        >
          {addressPrefix}
        </span>
        <button
          className="header-action"
          type="button"
          onClick={() => void disconnectWallet()}
          disabled={disconnecting}
        >
          {disconnecting ? "Disconnecting…" : "Disconnect wallet"}
        </button>
        {message && <span className="wallet-control-message" role="status">{message}</span>}
      </div>
    );
  }

  return (
    <div className="wallet-control">
      <button
        className="header-action"
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
    </div>
  );
}
