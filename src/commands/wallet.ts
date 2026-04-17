import { makeSolanaContext } from "../solana/makeAgent";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";
import { solanaExplorerAddressUrl } from "../solana/explorerLinks";
import { getSolBalance, getSplTokenBalances } from "../state/balances";

export async function runWalletStatus(): Promise<void> {
  logger.section("Wallet Status");

  const config = loadConfig();
  const { connection, keypair, walletAddress } = makeSolanaContext();

  logger.info(`Wallet: ${walletAddress}`);
  logger.info(`Explorer: ${solanaExplorerAddressUrl(walletAddress, config.solanaNetwork as any)}`);

  const sol = await getSolBalance(connection, keypair.publicKey);
  logger.success(`SOL: ${sol.sol.toFixed(6)} (${sol.lamports} lamports)`);

  const tokens = await getSplTokenBalances(connection, keypair.publicKey);
  if (tokens.length === 0) {
    logger.info("SPL tokens: (none / all zero)");
  } else {
    logger.section("SPL Token Balances (non-zero)");
    for (const t of tokens.slice(0, 25)) {
      logger.raw(`- mint=${t.mint} ui=${t.uiAmountString} acct=${t.ownerTokenAccount}`);
    }
    if (tokens.length > 25) logger.raw(`...and ${tokens.length - 25} more`);
  }

  logger.blank();
}
