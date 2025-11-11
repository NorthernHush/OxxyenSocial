// Frontend E2E Encryption Utilities using Web Crypto API

// Generate RSA key pair for E2E encryption
export const generateRSAKeyPair = async () => {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  return {
    publicKey: btoa(String.fromCharCode(...new Uint8Array(publicKey))),
    privateKey: btoa(String.fromCharCode(...new Uint8Array(privateKey))),
  };
};

// Import RSA public key from base64
export const importRSAPublicKey = async (publicKeyBase64) => {
  const publicKeyDer = Uint8Array.from(atob(publicKeyBase64), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'spki',
    publicKeyDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
};

// Import RSA private key from base64
export const importRSAPrivateKey = async (privateKeyBase64) => {
  const privateKeyDer = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'pkcs8',
    privateKeyDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
};

// Generate AES session key
export const generateSessionKey = async () => {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// Import AES session key from base64
export const importSessionKey = async (keyBase64) => {
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
};

// Encrypt message with AES-GCM
export const encryptMessage = async (message, sessionKey) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importSessionKey(sessionKey);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    new TextEncoder().encode(message)
  );

  return {
    encryptedContent: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    authTag: '', // Web Crypto API handles auth tag internally
  };
};

// Decrypt message with AES-GCM
export const decryptMessage = async (encryptedContent, sessionKey, iv) => {
  try {
    const key = await importSessionKey(sessionKey);
    const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
    const encryptedData = Uint8Array.from(atob(encryptedContent), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivData,
      },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message');
  }
};

// Encrypt session key with RSA public key
export const encryptSessionKey = async (sessionKeyBase64, publicKey) => {
  const rsaPublicKey = await importRSAPublicKey(publicKey);
  const sessionKeyData = Uint8Array.from(atob(sessionKeyBase64), c => c.charCodeAt(0));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    rsaPublicKey,
    sessionKeyData
  );

  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};

// Decrypt session key with RSA private key
export const decryptSessionKey = async (encryptedSessionKeyBase64, privateKey) => {
  const rsaPrivateKey = await importRSAPrivateKey(privateKey);
  const encryptedData = Uint8Array.from(atob(encryptedSessionKeyBase64), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    rsaPrivateKey,
    encryptedData
  );

  return btoa(String.fromCharCode(...new Uint8Array(decrypted)));
};

// Encrypt private key with password (PBKDF2 + AES)
export const encryptPrivateKey = async (privateKeyBase64, password) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const privateKeyData = Uint8Array.from(atob(privateKeyBase64), c => c.charCodeAt(0));

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    privateKeyData
  );

  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
  };
};

// Decrypt private key with password
export const decryptPrivateKey = async (encryptedData, password) => {
  const { encrypted, salt, iv } = encryptedData;

  const saltData = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
  const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const encryptedKeyData = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivData,
    },
    key,
    encryptedKeyData
  );

  return btoa(String.fromCharCode(...new Uint8Array(decrypted)));
};
