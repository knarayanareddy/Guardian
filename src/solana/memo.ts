import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

/**
 * Memo program id is commonly referenced as:
 * MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
 */
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export interface SendMemoResult {
  signature: string;
  memo: string;
}

/**
 * Sends a standalone memo transaction.
 * We include the payer key as an instruction key (signer) like common examples.
 */
export async function sendMemoTx(params: {
  connection: Connection;
  payer: Keypair;
  memo: string;
}): Promise<SendMemoResult> {
  const { connection, payer, memo } = params;

  if (!memo || memo.trim().length === 0) {
    throw new Error("Memo cannot be empty.");
  }
  if (Buffer.byteLength(memo, "utf8") > 800) {
    throw new Error("Memo too large for MVP (cap 800 bytes).");
  }

  const ix = new TransactionInstruction({
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });

  const tx = new Transaction().add(ix);

  const signature = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });

  return { signature, memo };
}
