import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardian Showcase Seeder
 * Generates high-fidelity mock data for the dashboard.
 */

const BASE_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const WIKI_DIR = path.join(BASE_DIR, 'wiki');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file: string, data: any) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function writeMd(file: string, content: string) {
  const dir = path.dirname(file);
  ensureDir(dir);
  fs.writeFileSync(file, content, 'utf8');
}

async function seed() {
  console.log('🌱 Seeding Guardian Showcase Data...');

  ensureDir(DATA_DIR);
  ensureDir(RUNS_DIR);
  ensureDir(WIKI_DIR);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Mock Ledger (Successful transactions)
  const ledger = [
    {
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      utcDate: todayStr,
      actionType: 'swap',
      lamports: 50000000,
      txSignature: '5AgW8...h3kLp',
      note: 'Arbitrage capture: SOL -> USDC -> SOL harvested 0.04 SOL profit'
    },
    {
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
      utcDate: todayStr,
      actionType: 'swap',
      lamports: 150000000,
      txSignature: '2NxR9...m1vQz',
      note: 'Volatility mitigation: De-risked 0.15 SOL to USDC (Threshold: 7% drawdown)'
    },
    {
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
      utcDate: '2026-04-16',
      actionType: 'transfer',
      lamports: 250000000,
      txSignature: '7YpL2...w8nBx',
      note: 'Scheduled cold storage re-balance (Vault: G7v...9wP)'
    }
  ];
  writeJson(path.join(DATA_DIR, 'spend-ledger.json'), ledger);

  // 2. Mock Runs (AI planning cycles)
  const runs = [
    {
      planId: 'plan-20260417-090000',
      timestamp: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      label: 'Arbitrage execution successful',
      reasoning: 'Spotted a 1.2% price discrepancy on Orca vs Raydium. Execution path SOL -> USDC -> SOL is profitable after priority fees.',
      actionType: 'swap',
      success: true,
      outcome: 'Earned 0.05 SOL profit after fees.'
    },
    {
      planId: 'plan-20260417-100000',
      timestamp: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      label: 'Monitoring: No action needed',
      reasoning: 'Market conditions are stable. Current drawdown is 1.2%, well below the 7% policy threshold.',
      actionType: 'none',
      success: true,
      outcome: 'System remains in Green status.'
    },
    {
      planId: 'plan-20260417-110000',
      timestamp: now.toISOString(),
      label: 'Blocked: High Slippage Risk',
      reasoning: 'AI attempted a large block swap, but liquidity is thin. Projected slippage is 4.5% (Policy Limit: 0.5%).',
      actionType: 'none',
      success: false,
      outcome: 'Execution HALTED by Deterministic Gate (Slippage Check failed).'
    }
  ];
  runs.forEach(run => writeJson(path.join(RUNS_DIR, `${run.planId}.json`), run));

  // 3. Mock Wiki (Narratives)
  writeMd(path.join(WIKI_DIR, 'INDEX.md'), `# Guardian Audit Wiki\n\nShowcase mode documentation.\n\n## Recent Reports\n- [Profit Harvest Narrative](receipts/harvest-001.md)\n- [Risk Mitigation Audit](receipts/risk-0417.md)`);
  writeMd(path.join(WIKI_DIR, 'receipts/harvest-001.md'), `# Arbitrage Harvest Narrative\n\n**ID:** rec-001\n**Time:** 2026-04-17T11:00:00Z\n\nGuardian spotted an inefficiency in the SOL/USDC pool. The plan was vetted against the **Slippage Policy** and **Daily Cap**. All checks passed green.\n\n### Result\n0.04 SOL net profit anchored to address \`5AgW8...h3kLp\`.`);
  writeMd(path.join(WIKI_DIR, 'receipts/risk-0417.md'), `# Risk Mitigation Audit\n\n**Priority:** High\n**Trigger:** Volatility Protection\n\nSolana dropped 7.2% within a 30-minute window. Guardian automatically triggered the **Drawdown Policy** and swapped 0.15 SOL to USDC to preserve capital.\n\n### Status\nCapital preserved. Monitoring for recovery before re-entry.`);

  console.log('✅ Showcase Seeding Complete. Restart Dashboard to see full flow.');
}

seed();
