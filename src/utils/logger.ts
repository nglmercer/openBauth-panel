import { Database } from "bun:sqlite";

// Simple logger implementation
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: any;
  error?: Error | undefined;
}

class Logger {
  private level: LogLevel;
  private db?: Database;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setDatabase(db: Database) {
    this.db = db;
  }

  private formatMessage(level: LogLevel, message: string, context?: any, error?: Error): string {
    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    let formatted = `[${timestamp}] [${levelName}] ${message}`;
    
    if (context) {
      formatted += ` | Context: ${JSON.stringify(context)}`;
    }
    
    if (error) {
      formatted += ` | Error: ${error.message}\n${error.stack}`;
    }
    
    return formatted;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private async logToDatabase(entry: LogEntry) {
    if (!this.db) return;
    
    try {
      this.db.run(
        `INSERT INTO logs (timestamp, level, message, context, error_stack) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          entry.timestamp.toISOString(),
          entry.level,
          entry.message,
          entry.context ? JSON.stringify(entry.context) : null,
          entry.error?.stack || null
        ]
      );
    } catch (error) {
      console.error('Failed to log to database:', error);
    }
  }

  error(message: string, error?: Error, context?: any) {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      error,
      context
    };
    
    console.error(this.formatMessage(LogLevel.ERROR, message, context, error));
    this.logToDatabase(entry);
  }

  warn(message: string, context?: any) {
    if (!this.shouldLog(LogLevel.WARN)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.WARN,
      message,
      context
    };
    
    console.warn(this.formatMessage(LogLevel.WARN, message, context));
    this.logToDatabase(entry);
  }

  info(message: string, context?: any) {
    if (!this.shouldLog(LogLevel.INFO)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      message,
      context
    };
    
    console.log(this.formatMessage(LogLevel.INFO, message, context));
    this.logToDatabase(entry);
  }

  debug(message: string, context?: any) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    
    const entry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      message,
      context
    };
    
    console.log(this.formatMessage(LogLevel.DEBUG, message, context));
    this.logToDatabase(entry);
  }
}

// Export singleton instance
export const defaultLogger = new Logger(
  process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO
);

export { Logger };