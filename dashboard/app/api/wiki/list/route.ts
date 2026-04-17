import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const WIKI_DIR = path.resolve(process.cwd(), '../wiki');

function getFiles(dir: string, baseDir: string): any[] {
  const results: any[] = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    const relPath = path.relative(baseDir, filePath);

    if (stat && stat.isDirectory()) {
      results.push({
        name: file,
        path: relPath,
        type: 'directory',
        children: getFiles(filePath, baseDir)
      });
    } else if (file.endsWith('.md')) {
      results.push({
        name: file,
        path: relPath,
        type: 'file'
      });
    }
  });

  return results;
}

export async function GET() {
  try {
    if (!fs.existsSync(WIKI_DIR)) {
      return NextResponse.json({ error: 'Wiki directory not found' }, { status: 404 });
    }
    const files = getFiles(WIKI_DIR, WIKI_DIR);
    return NextResponse.json(files);
  } catch (error) {
    console.error("Wiki List API Error:", error);
    return NextResponse.json({ error: 'Failed to list wiki files' }, { status: 500 });
  }
}
