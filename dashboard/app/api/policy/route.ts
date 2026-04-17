import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const POLICY_PATH = path.resolve(process.cwd(), '../data/policy.json');

export async function GET() {
  try {
    if (!fs.existsSync(POLICY_PATH)) {
      return NextResponse.json({ error: 'Policy file not found' }, { status: 404 });
    }
    const data = fs.readFileSync(POLICY_PATH, 'utf8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read policy' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const newPolicy = await request.json();
    
    // Basic validation
    if (!newPolicy.maxSingleActionLamports || !newPolicy.dailySpendCapLamports) {
      return NextResponse.json({ error: 'Invalid policy data' }, { status: 400 });
    }

    fs.writeFileSync(POLICY_PATH, JSON.stringify(newPolicy, null, 2), 'utf8');
    return NextResponse.json({ success: true, policy: newPolicy });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update policy' }, { status: 500 });
  }
}
