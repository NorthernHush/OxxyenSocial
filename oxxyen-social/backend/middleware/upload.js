const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const fs = require('fs').promises;

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/avi',
    'video/mov',
    'application/pdf',
    'text/plain'
  ];

  // Block dangerous file types
  const blockedExtensions = ['.exe', '.apk', '.dll', '.bat', '.cmd', '.scr', '.pif', '.com'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (blockedExtensions.includes(ext)) {
    return cb(new Error('Запрещённый тип файла'), false);
  }

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый тип файла'), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 // 5MB default
  }
});

// Process image after upload (resize and compress)
const processImage = async (filePath, filename) => {
  try {
    const processedPath = path.join(path.dirname(filePath), 'processed_' + filename);

    await sharp(filePath)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toFile(processedPath);

    // Replace original with processed
    await fs.unlink(filePath);
    await fs.rename(processedPath, filePath);

    return filename;
  } catch (error) {
    console.error('Image processing error:', error);
    return filename; // Return original if processing fails
  }
};

// Middleware to process uploaded files
const processUploads = async (req, res, next) => {
  if (req.files) {
    for (const file of req.files) {
      if (file.mimetype.startsWith('image/')) {
        const filePath = path.join(__dirname, '../../uploads', file.filename);
        file.filename = await processImage(filePath, file.filename);
      }
    }
  }

  if (req.file && req.file.mimetype.startsWith('image/')) {
    const filePath = path.join(__dirname, '../../uploads', req.file.filename);
    req.file.filename = await processImage(filePath, req.file.filename);
  }

  next();
};

module.exports = upload;
module.exports.processUploads = processUploads;
