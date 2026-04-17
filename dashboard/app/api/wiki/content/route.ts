import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const WIKI_DIR = path.resolve(process.cwd(), '../wiki');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const relPath = searchParams.get('path');

    if (!relPath) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 });
    }

    // Security: sanitize path to prevent directory traversal
    const safePath = path.join(WIKI_DIR, path.normalize(relPath).replace(/^(\.\.[\/\\])+/, ''));

    if (!safePath.startsWith(WIKI_DIR)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = fs.readFileSync(safePath, 'utf8');
    return NextResponse.json({ content });
  } catch (error) {
    console.error("Wiki Content API Error:", error);
    return NextResponse.json({ error: 'Failed to read wiki content' }, { status: 500 });
  }
}
