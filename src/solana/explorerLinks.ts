export type SolanaCluster = "devnet" | "testnet" | "mainnet-beta";

export function solanaExplorerTxUrl(signature: string, cluster: SolanaCluster): string {
  const c = encodeURIComponent(cluster);
  return `https://explorer.solana.com/tx/${signature}?cluster=${c}`;
}

export function solscanTxUrl(signature: string, cluster: SolanaCluster): string {
  if (cluster === "mainnet-beta") return `https://solscan.io/tx/${signature}`;
  return `https://solscan.io/tx/${signature}?cluster=${encodeURIComponent(cluster)}`;
}

export function solanaExplorerAddressUrl(address: string, cluster: SolanaCluster): string {
  const c = encodeURIComponent(cluster);
  return `https://explorer.solana.com/address/${address}?cluster=${c}`;
}
