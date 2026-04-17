import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { makeSolanaContext } from "../solana/makeAgent";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";
import { solanaExplorerTxUrl, solscanTxUrl } from "../solana/explorerLinks";
import { getSolBalance } from "../state/balances";

function parseSolAmount(input: string): number {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid SOL amount: ${input}`);
  return n;
}

export async function runAirdrop(solAmountStr: string): Promise<void> {
  logger.section("Devnet Airdrop");

  const config = loadConfig();
  const { connection, keypair, walletAddress } = makeSolanaContext();

  if (config.solanaNetwork !== "devnet" && config.solanaNetwork !== "testnet") {
    throw new Error(`Airdrop only supported on devnet/testnet (current: ${config.solanaNetwork})`);
  }

  const solAmount = parseSolAmount(solAmountStr);
  const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

  logger.info(`Wallet: ${walletAddress}`);
  logger.info(`Requesting airdrop: ${solAmount} SOL (${lamports} lamports)`);

  const sig = await connection.requestAirdrop(new PublicKey(walletAddress), lamports);

  logger.success(`Airdrop signature: ${sig}`);
  logger.info(`Explorer: ${solanaExplorerTxUrl(sig, config.solanaNetwork as any)}`);
  logger.info(`Solscan:   ${solscanTxUrl(sig, config.solanaNetwork as any)}`);

  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
    "confirmed"
  );

  const bal = await getSolBalance(connection, keypair.publicKey);
  logger.success(`New SOL balance: ${bal.sol.toFixed(6)} SOL`);
  logger.blank();
}
