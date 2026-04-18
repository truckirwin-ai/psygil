// Structured logger that writes to stderr with ISO timestamps.
// Never use console.log in production paths.

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg: message,
  };
  if (meta !== undefined) {
    Object.assign(entry, meta);
  }
  process.stderr.write(JSON.stringify(entry) + '\n');
}
