import * as fs from "fs";
import * as path from "path";
import { loadConfig } from "../config/loadConfig";
import { logger } from "../utils/logger";
import { DaemonStateSchema, type DaemonState } from "./daemon-state.schema";

function statePath(): string {
  const config = loadConfig();
  return path.join(config.dataDir, "daemon-state.json");
}

export function loadDaemonState(): DaemonState {
  const p = statePath();
  if (!fs.existsSync(p)) return DaemonStateSchema.parse({});

  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw);
    return DaemonStateSchema.parse(parsed);
  } catch (err) {
    logger.warn(`daemon-state.json malformed. Resetting. (${String(err)})`);
    return DaemonStateSchema.parse({});
  }
}

export function saveDaemonState(state: DaemonState): void {
  const config = loadConfig();
  if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });

  const p = statePath();
  const validated = DaemonStateSchema.parse(state);
  fs.writeFileSync(p, JSON.stringify(validated, null, 2), "utf8");
}

export function resetBackoff(state: DaemonState): DaemonState {
  return { ...state, backoffSeconds: 0 };
}

export function increaseBackoff(state: DaemonState): DaemonState {
  const config = loadConfig();
  const current = state.backoffSeconds ?? 0;
  const next = current === 0 ? 10 : Math.min(config.daemonBackoffMaxSeconds, current * 2);
  return { ...state, backoffSeconds: next };
}
