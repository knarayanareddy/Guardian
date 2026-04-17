import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LEDGER_PATH = path.resolve(process.cwd(), '../data/spend-ledger.json');
const RUNS_DIR = path.resolve(process.cwd(), '../data/runs');

export async function GET() {
  try {
    const activity: any[] = [];

    // 1. Get Spend Ledger items
    if (fs.existsSync(LEDGER_PATH)) {
      const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
      if (Array.isArray(ledger)) {
        ledger.forEach(item => {
          activity.push({
            type: 'transaction',
            id: item.txSignature || `tx-${item.timestamp}`,
            timestamp: item.timestamp,
            title: `Executed ${item.actionType}`,
            desc: item.note || `Transaction of ${item.lamports / 1e9} SOL`,
            status: 'success',
            metadata: item
          });
        });
      }
    }

    // 2. Get LLM Run items
    if (fs.existsSync(RUNS_DIR)) {
      const runFiles = fs.readdirSync(RUNS_DIR).filter(f => f.endsWith('.json'));
      runFiles.forEach(file => {
        const run = JSON.parse(fs.readFileSync(path.join(RUNS_DIR, file), 'utf8'));
        activity.push({
          type: 'plan',
          id: `run-${run.timestamp || file}`,
          timestamp: run.timestamp || new Date().toISOString(),
          title: `AI Plan: ${run.label || 'Autonomous Run'}`,
          desc: run.outcome || 'Strategic planning cycle complete',
          status: run.success ? 'success' : 'info',
          metadata: run
        });
      });
    }

    // Sort by timestamp descending
    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(activity.slice(0, 50)); // Return top 50
  } catch (error) {
    console.error("Activity API Error:", error);
    return NextResponse.json({ error: 'Failed to fetch activity feed' }, { status: 500 });
  }
}
