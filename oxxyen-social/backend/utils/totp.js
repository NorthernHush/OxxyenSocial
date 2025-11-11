const speakeasy = require('speakeasy');

// Generate TOTP secret
const generateTOTPSecret = () => {
  return speakeasy.generateSecret({
    name: 'OXXYEN SOCIAL',
    issuer: 'OXXYEN SOCIAL'
  });
};

// Verify TOTP token
const verifyTOTPToken = (secret, token, window = 2) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: window
  });
};

// Generate TOTP token (for testing)
const generateTOTPToken = (secret) => {
  return speakeasy.totp({
    secret: secret,
    encoding: 'base32'
  });
};

module.exports = {
  generateTOTPSecret,
  verifyTOTPToken,
  generateTOTPToken
};
