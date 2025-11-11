const crypto = require('crypto-js');

// Client-side encryption key (derived from user password)
const getEncryptionKey = (password) => {
  return crypto.SHA256(password + process.env.ENCRYPTION_KEY).toString();
};

// Encrypt data (for client-side use)
const encryptData = (data, key) => {
  return crypto.AES.encrypt(JSON.stringify(data), key).toString();
};

// Decrypt data (for client-side use)
const decryptData = (encryptedData, key) => {
  try {
    const bytes = crypto.AES.decrypt(encryptedData, key);
    return JSON.parse(bytes.toString(crypto.enc.Utf8));
  } catch (error) {
    throw new Error('Не удалось расшифровать данные');
  }
};

// Generate random key for file encryption
const generateFileKey = () => {
  return crypto.lib.WordArray.random(256/8).toString();
};

// Encrypt file data
const encryptFile = (fileData, key) => {
  return crypto.AES.encrypt(fileData, key).toString();
};

// Decrypt file data
const decryptFile = (encryptedData, key) => {
  try {
    const bytes = crypto.AES.decrypt(encryptedData, key);
    return bytes.toString(crypto.enc.Utf8);
  } catch (error) {
    throw new Error('Не удалось расшифровать файл');
  }
};

module.exports = {
  getEncryptionKey,
  encryptData,
  decryptData,
  generateFileKey,
  encryptFile,
  decryptFile
};
