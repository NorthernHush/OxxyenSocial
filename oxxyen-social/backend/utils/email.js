const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify email exists (SMTP validation)
const verifyEmail = async (email) => {
  try {
    // Extract domain from email
    const domain = email.split('@')[1];

    // Check MX records (basic validation)
    const dns = require('dns').promises;
    const mxRecords = await dns.resolveMx(domain);

    if (mxRecords.length === 0) {
      return false;
    }

    // Try to connect to SMTP server (basic check)
    const net = require('net');
    const mxHost = mxRecords[0].exchange;

    return new Promise((resolve) => {
      const socket = net.createConnection(25, mxHost);
      socket.setTimeout(5000);

      socket.on('connect', () => {
        socket.write(`HELO ${domain}\r\n`);
        socket.write(`MAIL FROM: <test@${domain}>\r\n`);
        socket.write(`RCPT TO: <${email}>\r\n`);
        socket.write('QUIT\r\n');
      });

      socket.on('data', (data) => {
        const response = data.toString();
        if (response.includes('250')) {
          resolve(true);
        } else if (response.includes('550') || response.includes('551') || response.includes('552')) {
          resolve(false);
        }
      });

      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return false;
  }
};

// Send email verification
const sendEmailVerification = async (email, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Подтверждение email - OXXYEN SOCIAL',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Подтверждение email</h2>
        <p>Добро пожаловать в OXXYEN SOCIAL!</p>
        <p>Для завершения регистрации подтвердите ваш email:</p>
        <a href="${verificationUrl}" style="background-color: #3B82F6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Подтвердить email</a>
        <p>Ссылка действительна 24 часа.</p>
        <p>Если вы не регистрировались, игнорируйте это письмо.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">OXXYEN SOCIAL - приватный мессенджер</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error('Не удалось отправить email');
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Сброс пароля - OXXYEN SOCIAL',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Сброс пароля</h2>
        <p>Вы запросили сброс пароля для аккаунта OXXYEN SOCIAL.</p>
        <p>Перейдите по ссылке ниже для сброса пароля:</p>
        <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Сбросить пароль</a>
        <p>Ссылка действительна в течение 1 часа.</p>
        <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">OXXYEN SOCIAL - приватный мессенджер</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    throw new Error('Не удалось отправить email');
  }
};

module.exports = {
  verifyEmail,
  sendEmailVerification,
  sendPasswordResetEmail
};
