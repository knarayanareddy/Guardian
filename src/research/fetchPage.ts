import { loadConfig } from "../config/loadConfig";
import { scanPromptInjection } from "../utils/scanPromptInjection";
import { logger } from "../utils/logger";
import { isSafeHttpUrl } from "./urlSafety";

export interface FetchPageResult {
  ok: boolean;
  url: string;
  finalUrl?: string;
  status?: number;
  contentType?: string;
  fetchedAt: string;
  html?: string;
  error?: string;
}

export async function fetchPageHtml(url: string): Promise<FetchPageResult> {
  const config = loadConfig();

  const safety = isSafeHttpUrl(url);
  if (!safety.ok) {
    return {
      ok: false,
      url,
      fetchedAt: new Date().toISOString(),
      error: `Unsafe URL: ${safety.reason}`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.browseTimeoutMs);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": config.browseUserAgent,
        "accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    const contentType = res.headers.get("content-type") ?? "";
    const status = res.status;

    // Only accept HTML-ish content
    if (!contentType.toLowerCase().includes("text/html")) {
      return {
        ok: false,
        url,
        finalUrl: res.url,
        status,
        contentType,
        fetchedAt: new Date().toISOString(),
        error: `Non-HTML content-type blocked: ${contentType}`,
      };
    }

    const html = await res.text();

    // Scan raw HTML for injection patterns (defense-in-depth)
    const scan = scanPromptInjection(html.slice(0, 50_000), "fetched_html");
    if (!scan.clean) {
      return {
        ok: false,
        url,
        finalUrl: res.url,
        status,
        contentType,
        fetchedAt: new Date().toISOString(),
        error: `Prompt injection patterns detected in HTML (${scan.findings.length}). Dropped.`,
      };
    }

    return {
      ok: res.ok,
      url,
      finalUrl: res.url,
      status,
      contentType,
      fetchedAt: new Date().toISOString(),
      html,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`fetchPageHtml failed: ${msg}`);
    return {
      ok: false,
      url,
      fetchedAt: new Date().toISOString(),
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}
