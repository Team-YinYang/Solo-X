/** Public, non-custodial SDK configuration for development networks. */
export const SOLO_X_NETWORKS = ["localnet", "devnet"] as const;
export type SoloXNetwork = (typeof SOLO_X_NETWORKS)[number];

export interface SoloXRpcConfig {
  readonly network: SoloXNetwork;
  readonly endpoint: string;
  readonly commitment: "confirmed";
}

const ENDPOINTS: Readonly<Record<SoloXNetwork, string>> = Object.freeze({
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
});

export function isSoloXNetwork(value: string): value is SoloXNetwork {
  return SOLO_X_NETWORKS.some((network) => network === value);
}

/** Return frozen RPC settings; no mainnet RPCs, signing or key custody. */
export function createSoloXRpcConfig(network: SoloXNetwork): SoloXRpcConfig {
  if (!isSoloXNetwork(network)) {
    throw new Error("Solo-X SDK supports only localnet or devnet during MVP development.");
  }
  return Object.freeze({
    network,
    endpoint: ENDPOINTS[network],
    commitment: "confirmed" as const,
  });
}
