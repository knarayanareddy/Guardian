import net from "node:net";

export interface UrlSafetyDecision {
  ok: boolean;
  reason?: string;
}

/**
 * Blocks local/private addresses and non-http(s) schemes.
 * This is an MVP SSRF guard for an agent that fetches URLs found on the web.
 */
export function isSafeHttpUrl(raw: string): UrlSafetyDecision {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: `Blocked scheme: ${u.protocol}` };
  }

  const host = (u.hostname || "").toLowerCase();

  // Block localhost-like hosts
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  ) {
    return { ok: false, reason: `Blocked local host: ${host}` };
  }

  // Block link-local metadata IP explicitly
  if (host === "169.254.169.254") {
    return { ok: false, reason: "Blocked metadata IP" };
  }

  // Block private IP ranges
  const ipType = net.isIP(host);
  if (ipType === 4) {
    const parts = host.split(".").map((x) => Number(x));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      const [a, b] = parts;

      // 10.0.0.0/8
      if (a === 10) return { ok: false, reason: "Blocked private IPv4 (10/8)" };

      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: "Blocked private IPv4 (172.16/12)" };

      // 192.168.0.0/16
      if (a === 192 && b === 168) return { ok: false, reason: "Blocked private IPv4 (192.168/16)" };

      // 0.0.0.0/8
      if (a === 0) return { ok: false, reason: "Blocked invalid IPv4 (0/8)" };

      // 127.0.0.0/8
      if (a === 127) return { ok: false, reason: "Blocked loopback IPv4 (127/8)" };

      // 169.254.0.0/16
      if (a === 169 && b === 254) return { ok: false, reason: "Blocked link-local IPv4 (169.254/16)" };
    }
  }

  // MVP: allow everything else
  return { ok: true };
}
