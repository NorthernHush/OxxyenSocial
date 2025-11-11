const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken, generateRefreshToken } = require('../utils/auth');
const { verifyEmail, sendEmailVerification, sendPasswordResetEmail } = require('../utils/email');
const { generateRSAKeyPair, encryptPrivateKey, decryptPrivateKey } = require('../utils/e2eEncryption');
const speakeasy = require('speakeasy');
const logger = require('../utils/logger');

const router = express.Router();

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { email, username, password } = req.body;

    // Verify email exists
    const emailExists = await verifyEmail(email);
    if (!emailExists) {
      return res.status(400).json({ message: 'Email не существует или недоступен' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Пользователь с таким email или username уже существует' });
    }

    // Generate RSA key pair for E2E encryption
    const { publicKey, privateKey } = await generateRSAKeyPair();

    // Encrypt private key with user password
    const encryptedPrivateKeyData = encryptPrivateKey(privateKey, password);

    // Create user
    const user = new User({
      email,
      username,
      password,
      publicKey,
      encryptedPrivateKey: encryptedPrivateKeyData.encrypted,
      privateKeySalt: encryptedPrivateKeyData.salt,
      privateKeyIv: encryptedPrivateKeyData.iv
    });

    await user.save();

    // Generate email verification token
    const verificationToken = jwt.sign(
      { userId: user._id, type: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    await sendEmailVerification(email, verificationToken);

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`User registered: ${username}`);

    res.status(201).json({
      message: 'Регистрация успешна. Проверьте email для подтверждения.',
      token,
      refreshToken,
      user: user.getPublicProfile(),
      requiresEmailVerification: true
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { email, password, twoFactorToken } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Неверный email или пароль' });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      return res.status(401).json({
        message: 'Email не подтвержден. Проверьте почту.',
        requiresEmailVerification: true
      });
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorToken) {
        return res.status(401).json({ message: 'Требуется код двухфакторной аутентификации' });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 2
      });

      if (!verified) {
        return res.status(401).json({ message: 'Неверный код двухфакторной аутентификации' });
      }
    }

    // Decrypt private key for client
    let privateKey = null;
    try {
      privateKey = decryptPrivateKey({
        encrypted: user.encryptedPrivateKey,
        salt: user.privateKeySalt,
        iv: user.privateKeyIv
      }, password);
    } catch (error) {
      return res.status(401).json({ message: 'Ошибка расшифровки ключей' });
    }

    // Update last seen
    await user.updateLastSeen();

    // Generate tokens
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    logger.info(`User logged in: ${user.username}`);

    res.json({
      message: 'Вход выполнен',
      token,
      refreshToken,
      user: {
        ...user.getPublicProfile(),
        privateKey // Send decrypted private key to client
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token не предоставлен' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const token = generateToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    res.json({ token, refreshToken: newRefreshToken });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({ message: 'Неверный refresh token' });
  }
});

// Setup 2FA
router.post('/setup-2fa', async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    const secret = speakeasy.generateSecret({
      name: `OXXYEN SOCIAL (${user.email})`,
      issuer: 'OXXYEN SOCIAL'
    });

    user.twoFactorSecret = secret.base32;
    await user.save();

    res.json({
      message: '2FA настроен',
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Verify and enable 2FA
router.post('/verify-2fa', [
  body('token').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const userId = req.user._id;
    const { token } = req.body;

    const user = await User.findById(userId);

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ message: 'Неверный код' });
    }

    user.twoFactorEnabled = true;
    await user.save();

    res.json({ message: '2FA включен' });
  } catch (error) {
    logger.error('2FA verification error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Disable 2FA
router.post('/disable-2fa', [
  body('token').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const userId = req.user._id;
    const { token } = req.body;

    const user = await User.findById(userId);

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({ message: 'Неверный код' });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    await user.save();

    res.json({ message: '2FA отключен' });
  } catch (error) {
    logger.error('2FA disable error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Request password reset
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверный email', errors: errors.array() });
    }

    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists
      return res.json({ message: 'Если email зарегистрирован, инструкции отправлены' });
    }

    // Generate reset token
    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'Инструкции по сбросу пароля отправлены на email' });
  } catch (error) {
    logger.error('Password reset request error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Reset password
router.post('/reset-password', [
  body('token').exists(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { token, password } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user || user.resetPasswordToken !== token || user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: 'Неверный или истёкший токен' });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Пароль успешно изменён' });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Verify email
router.post('/verify-email', [
  body('token').exists()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Неверные данные', errors: errors.array() });
    }

    const { token } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'email_verification') {
      return res.status(400).json({ message: 'Неверный токен' });
    }

    const user = await User.findById(decoded.userId);
    if (!user || user.emailVerificationToken !== token || user.emailVerificationExpires < Date.now()) {
      return res.status(400).json({ message: 'Неверный или истёкший токен' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    logger.info(`Email verified for user: ${user.username}`);

    res.json({ message: 'Email подтвержден' });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (user.emailVerified) {
      return res.status(400).json({ message: 'Email уже подтвержден' });
    }

    // Generate new verification token
    const verificationToken = jwt.sign(
      { userId: user._id, type: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    // Send verification email
    await sendEmailVerification(user.email, verificationToken);

    res.json({ message: 'Письмо с подтверждением отправлено' });
  } catch (error) {
    logger.error('Resend verification error:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
