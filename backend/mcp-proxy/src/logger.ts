import fs from 'fs';
import path from 'path';

const LOG_FILE = process.env.LOG_FILE
  ?? path.join(process.cwd(), 'agent-permissions.log');

// Open file handle once, append-only
const stream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

export interface LogEntry {
  timestamp: string;
  tool: string;
  resourcePath: string;
  action: string;
  effect: 'allowed' | 'denied';
  reason: string;
  matchedRule: string | null;
}

export function log(entry: LogEntry): void {
  const line = JSON.stringify(entry) + '\n';
  stream.write(line);
  // Also print a human-readable summary to stderr so the developer
  // can see what's happening without opening the log file
  const icon = entry.effect === 'allowed' ? '✅' : '🚫';
  process.stderr.write(
    `${icon} [${entry.timestamp}] ${entry.effect.toUpperCase()} ${entry.tool}("${entry.resourcePath}") — ${entry.reason}\n`
  );
}

export function getLogFile(): string {
  return LOG_FILE;
}
