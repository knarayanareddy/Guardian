import he from "he";

/**
 * Remove scripts/styles and convert HTML into plain text.
 * This is a heuristic extractor (not full Readability).
 */
export function extractTextFromHtml(html: string): { title?: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleRaw = titleMatch?.[1]?.trim();
  const title = titleRaw ? cleanText(decodeEntities(titleRaw)) : undefined;

  let h = html;

  // Remove script/style/noscript/svg/canvas
  h = h.replace(/<script[\s\S]*?<\/script>/gi, " ");
  h = h.replace(/<style[\s\S]*?<\/style>/gi, " ");
  h = h.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  h = h.replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  h = h.replace(/<canvas[\s\S]*?<\/canvas>/gi, " ");

  // Remove HTML comments
  h = h.replace(/<!--[\s\S]*?-->/g, " ");

  // Insert newlines for block-ish tags
  h = h.replace(/<(br|br\/)\s*\/?>/gi, "\n");
  h = h.replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6)>/gi, "\n");
  h = h.replace(/<(p|div|li|tr|h1|h2|h3|h4|h5|h6)[^>]*>/gi, "\n");

  // Strip remaining tags
  h = h.replace(/<[^>]+>/g, " ");

  // Decode entities and normalize whitespace
  const decoded = decodeEntities(h);
  const text = cleanText(decoded);

  return { title, text };
}

function decodeEntities(s: string): string {
  try {
    return he.decode(s);
  } catch {
    return s;
  }
}

function cleanText(s: string): string {
  // normalize whitespace, collapse excessive newlines
  return s
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
