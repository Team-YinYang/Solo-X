"use client";

import { useEffect, useState } from "react";

type PublicKey = { toBase58: () => string };

type SolanaWallet = {
  publicKey?: PublicKey;
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signMessage: (
    message: Uint8Array,
    display?: "utf8",
  ) => Promise<{ signature: Uint8Array }>;
};

declare global {
  interface Window {
    solana?: SolanaWallet;
  }
}

const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const DEFAULT_DEVNET_RPC = "https://api.devnet.solana.com";
const WALLET_PROOF = "Solo-X devnet wallet verification";

type NetworkStatus = "checking" | "ready" | "wrong-network" | "unavailable";

function networkSettings() {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? DEFAULT_DEVNET_RPC;
  return { network, rpcUrl };
}

async function checkNetwork(): Promise<NetworkStatus> {
  const { network, rpcUrl } = networkSettings();
  if (network !== "devnet" && network !== "localnet") return "wrong-network";

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash" }),
    });
    const payload = (await response.json()) as { result?: string };

    if (!response.ok || !payload.result) return "unavailable";
    if (network === "devnet" && payload.result !== DEVNET_GENESIS_HASH) {
      return "wrong-network";
    }
    return "ready";
  } catch {
    return "unavailable";
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function WalletPanel() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>("checking");
  const [address, setAddress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void checkNetwork().then((status) => {
      if (!cancelled) setNetworkStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    setMessage(null);
    if (networkStatus !== "ready") {
      setMessage("Choose a reachable devnet or local validator RPC before connecting.");
      return;
    }

    const wallet = window.solana;
    if (!wallet) {
      setMessage("No compatible browser wallet was found. Install or unlock Phantom, then try again.");
      return;
    }

    setIsWorking(true);
    try {
      const result = await wallet.connect();
      setAddress(result.publicKey.toBase58());
    } catch {
      setMessage("Wallet connection was cancelled or rejected. No account was connected.");
    } finally {
      setIsWorking(false);
    }
  }

  async function disconnect() {
    const wallet = window.solana;
    setIsWorking(true);
    try {
      await wallet?.disconnect();
    } finally {
      setAddress(null);
      setMessage(null);
      setIsWorking(false);
    }
  }

  async function verifyWallet() {
    const wallet = window.solana;
    if (!wallet) return;

    setMessage(null);
    setIsWorking(true);
    try {
      await wallet.signMessage(new TextEncoder().encode(WALLET_PROOF), "utf8");
      setMessage("Signature accepted. This confirms your wallet only; no transaction was submitted.");
    } catch {
      setMessage("Signature was cancelled or rejected. No transaction was submitted.");
    } finally {
      setIsWorking(false);
    }
  }

  const { network, rpcUrl } = networkSettings();
  const networkLabel = network === "localnet" ? "Local validator" : "Devnet";
  const isReady = networkStatus === "ready";

  return (
    <aside className="wallet-panel" aria-label="Wallet connection">
      <div>
        <span className="eyebrow">Wallet</span>
        <h2>{address ? shortAddress(address) : "Connect a test wallet"}</h2>
        <p>{address ? "Connected for this browser session." : "Use Phantom with test funds only."}</p>
      </div>
      <div className={`network-status ${networkStatus}`}>
        <strong>{networkLabel}</strong>
        <span>{networkStatus === "ready" ? "RPC verified" : networkStatus === "checking" ? "Checking RPC" : networkStatus === "wrong-network" ? "Wrong network" : "RPC unavailable"}</span>
      </div>
      <p className="wallet-rpc">{rpcUrl}</p>
      {address ? (
        <div className="wallet-actions">
          <button className="wallet-button secondary" onClick={verifyWallet} disabled={isWorking} type="button">Verify signature</button>
          <button className="wallet-button" onClick={disconnect} disabled={isWorking} type="button">Disconnect</button>
        </div>
      ) : (
        <button className="wallet-button" onClick={connect} disabled={isWorking || !isReady} type="button">
          {isWorking ? "Connecting..." : "Connect wallet"}
        </button>
      )}
      {message && <p className="wallet-message" role="status">{message}</p>}
      {networkStatus === "wrong-network" && <p className="wallet-message" role="alert">Solo-X accepts devnet or a local validator only. Mainnet is blocked.</p>}
    </aside>
  );
}
