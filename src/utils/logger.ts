import chalk from "chalk";

export type LogLevel = "info" | "success" | "warn" | "error" | "debug" | "section";

const ICONS: Record<LogLevel, string> = {
  info: "◆",
  success: "✓",
  warn: "⚠",
  error: "✗",
  debug: "·",
  section: "═",
};

const COLORS: Record<LogLevel, (s: string) => string> = {
  info: chalk.cyan,
  success: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  debug: chalk.gray,
  section: chalk.magenta,
};

function timestamp(): string {
  return chalk.gray(new Date().toISOString());
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const icon = ICONS[level];
  const color = COLORS[level];
  const prefix = color(`${icon} [${level.toUpperCase()}]`);

  if (level === "section") {
    const line = "═".repeat(60);
    console.log(color(`\n${line}`));
    console.log(color(`  ${message}`));
    console.log(color(`${line}\n`));
    return;
  }

  console.log(`${timestamp()} ${prefix} ${message}`);

  if (data !== undefined) {
    if (typeof data === "object" && data !== null) {
      console.log(chalk.gray(JSON.stringify(data, null, 2)));
    } else {
      console.log(chalk.gray(String(data)));
    }
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log("info", message, data),
  success: (message: string, data?: unknown) => log("success", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
  debug: (message: string, data?: unknown) => log("debug", message, data),
  section: (message: string) => log("section", message),
  raw: (message: string) => console.log(message),
  blank: () => console.log(""),
};
