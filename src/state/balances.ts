import { Connection, PublicKey, ParsedAccountData } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "../solana/addresses";

export interface SolBalance {
  lamports: number;
  sol: number;
}

export interface TokenBalance {
  mint: string;
  ownerTokenAccount: string;
  amountRaw: string;        // integer string
  decimals: number;
  uiAmount: number | null;  // may be null sometimes
  uiAmountString: string;
}

export async function getSolBalance(connection: Connection, address: PublicKey): Promise<SolBalance> {
  const lamports = await connection.getBalance(address, "confirmed");
  return { lamports, sol: lamports / 1e9 };
}

interface ParsedTokenAmount {
  amount: string;
  decimals: number;
  uiAmount: number | null;
  uiAmountString: string;
}

interface ParsedTokenAccountInfo {
  mint: string;
  tokenAmount: ParsedTokenAmount;
}

export async function getSplTokenBalances(
  connection: Connection,
  owner: PublicKey
): Promise<TokenBalance[]> {
  const res = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const balances: TokenBalance[] = [];

  for (const item of res.value) {
    const data = item.account.data as ParsedAccountData;
    if (!data?.parsed?.info) continue;

    const info = data.parsed.info as unknown as ParsedTokenAccountInfo;
    if (!info?.mint || !info?.tokenAmount) continue;

    const tb: TokenBalance = {
      mint: info.mint,
      ownerTokenAccount: item.pubkey.toBase58(),
      amountRaw: info.tokenAmount.amount,
      decimals: info.tokenAmount.decimals,
      uiAmount: info.tokenAmount.uiAmount,
      uiAmountString: info.tokenAmount.uiAmountString,
    };

    // Filter out empty token accounts
    if (tb.amountRaw !== "0") balances.push(tb);
  }

  // Sort descending by uiAmount if present
  balances.sort((a, b) => (Number(b.uiAmount ?? 0) - Number(a.uiAmount ?? 0)));
  return balances;
}
