import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../config/loadConfig";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Sha256 = require("sha.js/sha256");

export interface CachedSummary {
  url: string;
  finalUrl?: string;

  fetchedAt: string;     // when the page HTML was fetched
  summarizedAt: string;  // when summary was generated

  unixTs: number;        // summarized time (seconds)
  ttlSeconds: number;

  title?: string;

  // Hash of extracted text input (not stored) for traceability
  contentHash: string;

  // Exactly 5 bullet strings
  bullets: [string, string, string, string, string];

  // LLM metadata
  llmBaseUrl: string;
  llmModel: string;

  // optional HTTP metadata
  status?: number;
  contentType?: string;
}

function sha256HexUtf8(input: string): string {
  return new Sha256().update(input, "utf8").digest("hex") as string;
}

function keyForUrl(url: string): string {
  return sha256HexUtf8(url);
}

function dirSummaries(): string {
  const config = loadConfig();
  return path.join(config.cacheDir, "summaries");
}

function filePath(url: string): string {
  return path.join(dirSummaries(), `${keyForUrl(url)}.json`);
}

export function isFresh(entry: CachedSummary): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - entry.unixTs <= entry.ttlSeconds;
}

export function loadSummary(url: string): CachedSummary | null {
  const p = filePath(url);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as CachedSummary;
  } catch {
    return null;
  }
}

export function saveSummary(entry: CachedSummary): void {
  const dir = dirSummaries();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath(entry.url), JSON.stringify(entry, null, 2), "utf8");
}

export function computeContentHash(text: string): string {
  return sha256HexUtf8(text);
}
