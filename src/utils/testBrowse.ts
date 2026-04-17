import { searchSearxng, formatSearxngContext } from "../research/searxng";
import { browseUrls, formatBrowsedPagesContext } from "../research/browse";

async function main() {
  const q = "Solana Sealevel parallel execution explained";
  console.log(`Starting test browse for: "${q}"`);
  
  const results = await searchSearxng(q);

  console.log("=== Search Context (snippets) ===");
  console.log(formatSearxngContext(results));
  console.log("");

  if (results.length === 0) {
    console.log("No results found. (Is SearXNG running?)");
    return;
  }

  const pages = await browseUrls(results.map((r) => r.url));
  console.log("=== Browsed Summaries Context (5 bullets each) ===");
  console.log(formatBrowsedPagesContext(pages));
  console.log("");
}

main().catch((e) => {
  console.error("testBrowse failed:", e);
  process.exit(1);
});
