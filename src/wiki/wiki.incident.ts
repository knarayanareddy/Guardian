import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../config/loadConfig";
import { nowIso } from "../utils/time";
import { logger } from "../utils/logger";

export function writeIncident(params: {
  incidentId: string;
  title: string;
  details: string;
}): string {
  const config = loadConfig();
  const dir = path.join(config.wikiDir, "incidents");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const p = path.join(dir, `${params.incidentId}.md`);
  const md = [
    `# Incident ${params.incidentId}`,
    ``,
    `- **Time:** ${nowIso()}`,
    `- **Title:** ${params.title}`,
    ``,
    `## Details`,
    ``,
    params.details,
    ``,
  ].join("\n");

  fs.writeFileSync(p, md, "utf8");
  logger.error(`Incident written: ${p}`);
  return p;
}
