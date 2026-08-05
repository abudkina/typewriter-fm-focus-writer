/**
 * Уровни логирования приложения.
 * В продакшене console.log запрещён — только через этот модуль.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  data?: unknown;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private minLevel: LogLevel = 'info';
  private history: LogEntry[] = [];
  private readonly maxHistory = 200;

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.minLevel];
  }

  private record(level: LogLevel, message: string, data?: unknown): void {
    const entry: LogEntry = { level, message, timestamp: Date.now(), data };
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (!this.shouldLog(level)) return;

    const prefix = `[Typewriter.fm][${level.toUpperCase()}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, message, data ?? '');
        break;
      case 'info':
        console.info(prefix, message, data ?? '');
        break;
      default:
        // debug — только в историю, без вывода в консоль по умолчанию
        break;
    }
  }

  debug(message: string, data?: unknown): void {
    this.record('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.record('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.record('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.record('error', message, data);
  }

  getHistory(): readonly LogEntry[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const logger = new Logger();
