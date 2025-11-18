/**
 * Logger Service
 *
 * Centralized logging with structured output for observability.
 * Provides contextual logging for rooms, players, and game events.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  roomId?: string;
  experimentId?: string;
  playerId?: string;
  round?: number;
  phase?: string;
  [key: string]: any;
}

class Logger {
  private level: LogLevel;

  constructor() {
    this.level = process.env.NODE_ENV === 'production'
      ? LogLevel.INFO
      : LogLevel.DEBUG;
  }

  /**
   * Format log message with timestamp and context
   */
  private format(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level} ${message}${ctx}`;
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(this.format('DEBUG', message, context));
    }
  }

  /**
   * Log informational message
   */
  info(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.INFO) {
      console.log(this.format('INFO', message, context));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.format('WARN', message, context));
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    if (this.level <= LogLevel.ERROR) {
      const errorContext = error ? { ...context, error: error.message, stack: error.stack } : context;
      console.error(this.format('ERROR', message, errorContext));
    }
  }

  /**
   * Log game event (structured for analytics)
   */
  gameEvent(event: string, data: Record<string, any>): void {
    const message = `GAME_EVENT: ${event}`;
    this.info(message, data);
  }
}

export const logger = new Logger();
