import { NextResponse } from 'next/server';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const LEDGER_PATH = path.resolve(process.cwd(), '../data/spend-ledger.json');
const KEYPAIR_PATH = path.resolve(process.cwd(), '../agent-keypair.json');

export async function GET() {
  try {
    // 1. Get Public Key from local keypair
    const secretKeyString = fs.readFileSync(KEYPAIR_PATH, 'utf8');
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    const keypair = Keypair.fromSecretKey(secretKey);
    const pubkey = keypair.publicKey.toBase58();

    // 2. Fetch balance from Solana (Devnet)
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    const balance = await connection.getBalance(new PublicKey(pubkey));

    // 3. Read spend ledger
    let totalSpent = 0;
    let recentTxCount = 0;
    if (fs.existsSync(LEDGER_PATH)) {
      const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
      if (Array.isArray(ledger)) {
        totalSpent = ledger.reduce((acc, curr) => acc + (curr.lamports || 0), 0);
        recentTxCount = ledger.length;
      }
    }

    return NextResponse.json({
      address: pubkey,
      balanceLamports: balance,
      balanceSol: balance / 1_000_000_000,
      totalSpentLamports: totalSpent,
      totalSpentSol: totalSpent / 1_000_000_000,
      recentTxCount,
      network: "devnet"
    });
  } catch (error) {
    console.error("Stats API Error:", error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
