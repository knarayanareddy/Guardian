import { makeSolanaContext } from "./src/solana/makeAgent";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const ctx = makeSolanaContext();
  console.log("Agent keys:", Object.keys(ctx.agent));
  if ((ctx.agent as any).methods) {
     console.log("Agent methods keys:", Object.keys((ctx.agent as any).methods));
  }
}

main().catch(console.error);
