/**
 * Structured logging utility for kaczmarek.ai-dev
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const LOG_LEVEL_NAMES = {
  0: "ERROR",
  1: "WARN",
  2: "INFO",
  3: "DEBUG"
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || (process.env.LOG_LEVEL || "INFO").toUpperCase();
    this.levelNum = LOG_LEVELS[this.level] !== undefined ? LOG_LEVELS[this.level] : LOG_LEVELS.INFO;
    this.context = options.context || {};
    this.prefix = options.prefix || "";
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext = {}) {
    return new Logger({
      level: this.level,
      context: { ...this.context, ...additionalContext },
      prefix: this.prefix
    });
  }

  /**
   * Log a message
   */
  _log(level, message, data = {}) {
    const levelNum = LOG_LEVELS[level];
    if (levelNum > this.levelNum) {
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      ...this.context,
      ...data
    };

    if (this.prefix) {
      logEntry.prefix = this.prefix;
    }

    // Format for console output
    const timestamp = logEntry.timestamp.substring(11, 19);
    const levelStr = level.padEnd(5);
    const prefixStr = this.prefix ? `[${this.prefix}] ` : "";
    const contextStr = Object.keys(this.context).length > 0 
      ? ` ${JSON.stringify(this.context)}` 
      : "";
    const dataStr = Object.keys(data).length > 0 
      ? ` ${JSON.stringify(data)}` 
      : "";

    const consoleMessage = `[${timestamp}] ${levelStr} ${prefixStr}${message}${contextStr}${dataStr}`;

    // Use appropriate console method
    switch (level) {
      case "ERROR":
        console.error(consoleMessage);
        if (data.stack) {
          console.error(data.stack);
        }
        break;
      case "WARN":
        console.warn(consoleMessage);
        break;
      case "DEBUG":
        console.debug(consoleMessage);
        break;
      default:
        console.log(consoleMessage);
    }

    return logEntry;
  }

  /**
   * Log error level
   */
  error(message, error = null, data = {}) {
    const errorData = { ...data };
    if (error) {
      errorData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      };
    }
    return this._log("ERROR", message, errorData);
  }

  /**
   * Log warning level
   */
  warn(message, data = {}) {
    return this._log("WARN", message, data);
  }

  /**
   * Log info level
   */
  info(message, data = {}) {
    return this._log("INFO", message, data);
  }

  /**
   * Log debug level
   */
  debug(message, data = {}) {
    return this._log("DEBUG", message, data);
  }
}

/**
 * Create a logger instance
 */
function createLogger(options = {}) {
  return new Logger(options);
}

/**
 * Create a logger with context
 */
function createContextLogger(context, options = {}) {
  return new Logger({ ...options, context });
}

module.exports = {
  Logger,
  createLogger,
  createContextLogger,
  LOG_LEVELS
};

