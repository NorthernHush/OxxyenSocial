const logger = require('../utils/logger');

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Error:', err);

  // Don't leak error details to client
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: 'Неверные данные' });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Неверный ID' });
  }

  if (err.code === 11000) {
    return res.status(400).json({ message: 'Дублирование данных' });
  }

  // Generic error response
  res.status(500).json({ message: 'Внутренняя ошибка сервера' });
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potential XSS
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        obj[key] = obj[key].replace(/<[^>]*>/g, ''); // Remove HTML tags
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });

  next();
};

// Data leak prevention
const checkDataLeak = async (req, res, next) => {
  // This would be a more complex implementation
  // For now, just log potential sensitive data patterns
  const sensitivePatterns = [
    /\b\d{10,}\b/g, // Phone numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g // Credit cards
  ];

  const checkString = JSON.stringify(req.body) + JSON.stringify(req.query);

  for (const pattern of sensitivePatterns) {
    if (pattern.test(checkString)) {
      logger.warn('Potential data leak detected in request');
      break;
    }
  }

  next();
};

module.exports = {
  errorHandler,
  sanitizeInput,
  requestLogger,
  checkDataLeak
};
