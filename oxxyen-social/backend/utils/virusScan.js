const clamscan = require('clamscan');
const path = require('path');
const logger = require('./logger');

// Initialize ClamAV scanner
let scanner = null;

const initScanner = async () => {
  try {
    scanner = await clamscan.init({
      remove_infected: false, // Don't remove files, just report
      quarantine_infected: false,
      scan_log: path.join(__dirname, '../../logs/virus_scan.log'),
      debug_mode: false
    });
    logger.info('ClamAV scanner initialized');
  } catch (error) {
    logger.error('Failed to initialize ClamAV scanner:', error);
    // Fallback: simple file type check
  }
};

// Scan file for viruses
const scanFile = async (filePath) => {
  try {
    if (!scanner) {
      await initScanner();
    }

    if (!scanner) {
      // Fallback check: block suspicious extensions
      const ext = path.extname(filePath).toLowerCase();
      const suspiciousExts = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.apk', '.dll'];

      if (suspiciousExts.includes(ext)) {
        logger.warn(`Blocked suspicious file: ${filePath}`);
        return { isInfected: true, viruses: ['Suspicious file extension'] };
      }

      return { isInfected: false };
    }

    const result = await scanner.is_infected(filePath);

    if (result.is_infected) {
      logger.warn(`Virus detected in file ${filePath}: ${result.viruses.join(', ')}`);
      return { isInfected: true, viruses: result.viruses };
    }

    return { isInfected: false };
  } catch (error) {
    logger.error('Virus scan error:', error);
    // In case of scan error, allow file but log it
    return { isInfected: false, error: error.message };
  }
};

// Middleware for file scanning
const scanUploadedFile = async (req, res, next) => {
  if (req.file) {
    const filePath = path.join(__dirname, '../../uploads', req.file.filename);
    const scanResult = await scanFile(filePath);

    if (scanResult.isInfected) {
      // Delete infected file
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return res.status(400).json({
        message: 'Файл содержит вредоносное ПО',
        viruses: scanResult.viruses
      });
    }
  }

  if (req.files) {
    for (const file of req.files) {
      const filePath = path.join(__dirname, '../../uploads', file.filename);
      const scanResult = await scanFile(filePath);

      if (scanResult.isInfected) {
        // Delete infected files
        const fs = require('fs');
        for (const f of req.files) {
          const fp = path.join(__dirname, '../../uploads', f.filename);
          if (fs.existsSync(fp)) {
            fs.unlinkSync(fp);
          }
        }

        return res.status(400).json({
          message: 'Один или несколько файлов содержат вредоносное ПО',
          viruses: scanResult.viruses
        });
      }
    }
  }

  next();
};

module.exports = {
  initScanner,
  scanFile,
  scanUploadedFile
};
