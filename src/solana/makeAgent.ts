import { Connection, Keypair } from "@solana/web3.js";
import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import TokenPlugin from "@solana-agent-kit/plugin-token";
import { loadConfig } from "../config/loadConfig";
import { loadKeypairFromFile } from "./loadKeypair";

export interface SolanaContext {
  connection: Connection;
  keypair: Keypair;
  walletAddress: string;
  agent: SolanaAgentKit;
}

/**
 * Creates:
 * - web3.js Connection (confirmed)
 * - Keypair (loaded from AGENT_KEYPAIR_PATH JSON)
 * - SolanaAgentKit agent + TokenPlugin
 *
 * Based on Solana Agent Kit v2 setup patterns.
 */
export function makeSolanaContext(): SolanaContext {
  const config = loadConfig();

  const connection = new Connection(config.solanaRpcUrl, "confirmed");
  const keypair = loadKeypairFromFile(config.agentKeypairPath);

  // Apply Patch A: KeypairWallet constructor expects 1 argument in some Agent Kit versions
  const wallet = new KeypairWallet(keypair, config.solanaRpcUrl);

  const kitCfg: Record<string, string> = {};
  if (config.openAiApiKey) kitCfg.OPENAI_API_KEY = config.openAiApiKey;

  const agent = new SolanaAgentKit(wallet, config.solanaRpcUrl, kitCfg).use(TokenPlugin);

  return {
    connection,
    keypair,
    walletAddress: keypair.publicKey.toBase58(),
    agent,
  };
}
