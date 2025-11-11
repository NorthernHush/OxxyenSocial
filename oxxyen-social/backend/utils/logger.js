const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Simple logger implementation
class Logger {
  constructor() {
    this.logFile = path.join(logsDir, 'audit.log');
  }

  _writeToFile(level, message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${level.toUpperCase()}] ${message}\n`;

    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  _log(level, message, ...args) {
    const fullMessage = `${message} ${args.length ? JSON.stringify(args) : ''}`;

    // Console output
    console.log(`[${level.toUpperCase()}] ${fullMessage}`);

    // File output for audit logs
    if (level === 'info' || level === 'warn' || level === 'error') {
      this._writeToFile(level, fullMessage);
    }
  }

  info(message, ...args) {
    this._log('info', message, ...args);
  }

  warn(message, ...args) {
    this._log('warn', message, ...args);
  }

  error(message, ...args) {
    this._log('error', message, ...args);
  }

  debug(message, ...args) {
    this._log('debug', message, ...args);
  }
}

module.exports = new Logger();
