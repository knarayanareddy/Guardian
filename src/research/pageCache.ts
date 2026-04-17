import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../config/loadConfig";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sha256 = require("sha.js/sha256");

export interface CachedPage {
  url: string;
  finalUrl?: string;
  fetchedAt: string;     // ISO
  unixTs: number;        // seconds
  ttlSeconds: number;

  title?: string;
  text: string;          // extracted full text (may be truncated)
  textHash: string;      // sha256 hex of text

  status?: number;
  contentType?: string;
}

function sha256HexUtf8(input: string): string {
  return new Sha256().update(input, "utf8").digest("hex") as string;
}

function keyForUrl(url: string): string {
  return sha256HexUtf8(url);
}

function cacheDir(): string {
  const config = loadConfig();
  return path.join(config.cacheDir, "pages");
}

function cachePath(url: string): string {
  return path.join(cacheDir(), `${keyForUrl(url)}.json`);
}

export function loadCachedPage(url: string): CachedPage | null {
  const p = cachePath(url);
  if (!fs.existsSync(p)) return null;

  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as CachedPage;
  } catch {
    return null;
  }
}

export function isCacheFresh(entry: CachedPage): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - entry.unixTs <= entry.ttlSeconds;
}

export function saveCachedPage(entry: CachedPage): void {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(cachePath(entry.url), JSON.stringify(entry, null, 2), "utf8");
}

export function computeTextHash(text: string): string {
  return sha256HexUtf8(text);
}
