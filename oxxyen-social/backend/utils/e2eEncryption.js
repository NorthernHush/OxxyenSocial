// E2E Encryption utilities using Web Crypto API compatible approach
const crypto = require('crypto');

// Generate RSA key pair for user
const generateRSAKeyPair = async () => {
  try {
    // Generate RSA key pair (2048 bits for compatibility)
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return {
      publicKey: publicKey,
      privateKey: privateKey
    };
  } catch (error) {
    throw new Error('Failed to generate RSA key pair');
  }
};

// Generate AES-256-GCM session key
const generateSessionKey = () => {
  return crypto.randomBytes(32); // 256 bits
};

// Encrypt message with AES-256-GCM
const encryptMessage = (message, sessionKey) => {
  try {
    const iv = crypto.randomBytes(16); // GCM recommended 96 bits, but 128 is fine
    const cipher = crypto.createCipher('aes-256-gcm', sessionKey);

    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  } catch (error) {
    throw new Error('Failed to encrypt message');
  }
};

// Decrypt message with AES-256-GCM
const decryptMessage = (encryptedData, sessionKey) => {
  try {
    const decipher = crypto.createDecipher('aes-256-gcm', sessionKey);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt message');
  }
};

// Encrypt session key with RSA public key
const encryptSessionKey = (sessionKey, publicKeyPem) => {
  try {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      sessionKey
    );
    return encrypted.toString('base64');
  } catch (error) {
    throw new Error('Failed to encrypt session key');
  }
};

// Decrypt session key with RSA private key
const decryptSessionKey = (encryptedSessionKey, privateKeyPem) => {
  try {
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      Buffer.from(encryptedSessionKey, 'base64')
    );
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt session key');
  }
};

// Hash password for encryption key derivation
const deriveEncryptionKey = (password, salt) => {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
};

// Encrypt private key for storage
const encryptPrivateKey = (privateKey, password) => {
  const salt = crypto.randomBytes(16);
  const key = deriveEncryptionKey(password, salt);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex')
  };
};

// Decrypt private key from storage
const decryptPrivateKey = (encryptedData, password) => {
  try {
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const key = deriveEncryptionKey(password, salt);
    const iv = Buffer.from(encryptedData.iv, 'hex');

    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt private key - invalid password');
  }
};

module.exports = {
  generateRSAKeyPair,
  generateSessionKey,
  encryptMessage,
  decryptMessage,
  encryptSessionKey,
  decryptSessionKey,
  encryptPrivateKey,
  decryptPrivateKey,
  deriveEncryptionKey
};
