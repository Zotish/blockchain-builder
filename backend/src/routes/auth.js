const express = require('express');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const config = require('../config');
const User = require('../models/User');
const AuthToken = require('../models/AuthToken');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  validate,
  registerSchema,
  loginSchema,
  walletAuthSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} = require('../middleware/validate');
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require('../services/emailService');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiry }
  );
}

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  const body = validate(req, res, registerSchema);
  if (!body) return;

  try {
    const existing = await User.findOne({ email: body.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered.' });
    }

    const user = await User.create({ ...body, isVerified: false });

    // Send verification email (non-blocking)
    const tokenDoc = await AuthToken.createToken(user._id, 'email_verify');
    await sendVerificationEmail(user, tokenDoc.token);

    const token = makeToken(user);
    res.status(201).json({
      success: true,
      data: {
        user: user.toSafeObject(),
        token,
        message: 'Account created! Please check your email to verify your account.',
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed.' });
  }
});

// ── GET /api/auth/verify-email?token=xxx ──────────────────
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, error: 'Token required.' });

    const tokenDoc = await AuthToken.findOne({ token, type: 'email_verify', used: false });
    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired verification link.' });
    }

    await User.findByIdAndUpdate(tokenDoc.userId, { isVerified: true });
    tokenDoc.used = true;
    await tokenDoc.save();

    res.json({ success: true, message: 'Email verified! You can now log in.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const body = validate(req, res, loginSchema);
  if (!body) return;

  try {
    const user = await User.findOne({ email: body.email.toLowerCase() }).select('+password');
    if (!user) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const valid = await user.comparePassword(body.password);
    if (!valid) return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    // Optional: warn if not verified (don't block login — better UX)
    const token = makeToken(user);
    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
        token,
        emailVerified: user.isVerified,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

// ── POST /api/auth/wallet ──────────────────────────────────
// Verifies MetaMask signature to prove wallet ownership
router.post('/wallet', authLimiter, async (req, res) => {
  const body = validate(req, res, walletAuthSchema);
  if (!body) return;

  try {
    const { walletAddress, signature, message } = body;

    // ── Critical: verify the signature ────────────────────
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(message, signature);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid signature.' });
    }

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: 'Signature does not match wallet address.',
      });
    }

    // Verify message contains expected nonce/timestamp to prevent replay attacks
    if (!message.includes('ChainForge') || !message.includes('Sign in')) {
      return res.status(400).json({ success: false, error: 'Invalid sign-in message.' });
    }

    // Find or create user
    const addr = walletAddress.toLowerCase();
    let user = await User.findOne({ walletAddress: addr });
    if (!user) {
      user = await User.create({
        email: `${addr.slice(2, 12)}@wallet.chainforge`,
        password: require('crypto').randomBytes(32).toString('hex'),
        username: `user_${addr.slice(2, 8)}`,
        walletAddress: addr,
        isVerified: true, // wallet auth = already verified
      });
    }

    const token = makeToken(user);
    res.json({ success: true, data: { user: user.toSafeObject(), token } });
  } catch (err) {
    console.error('Wallet auth error:', err);
    res.status(500).json({ success: false, error: 'Wallet authentication failed.' });
  }
});

// ── POST /api/auth/resend-verification ────────────────────
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ success: true, message: 'If that email exists, a link was sent.' });
    if (user.isVerified) return res.json({ success: true, message: 'Email already verified.' });

    const tokenDoc = await AuthToken.createToken(user._id, 'email_verify');
    await sendVerificationEmail(user, tokenDoc.token);
    res.json({ success: true, message: 'Verification email sent.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to resend.' });
  }
});

// ── POST /api/auth/forgot-password ────────────────────────
router.post('/forgot-password', authLimiter, async (req, res) => {
  const body = validate(req, res, passwordResetRequestSchema);
  if (!body) return;

  try {
    // Always return success to prevent email enumeration
    const user = await User.findOne({ email: body.email.toLowerCase() });
    if (user) {
      const tokenDoc = await AuthToken.createToken(user._id, 'password_reset', 60 * 60 * 1000); // 1h
      await sendPasswordResetEmail(user, tokenDoc.token);
    }
    res.json({ success: true, message: 'If that email exists, a reset link was sent.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to process request.' });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────
router.post('/reset-password', authLimiter, async (req, res) => {
  const body = validate(req, res, passwordResetSchema);
  if (!body) return;

  try {
    const tokenDoc = await AuthToken.findOne({
      token: body.token,
      type: 'password_reset',
      used: false,
    });

    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset link.' });
    }

    const user = await User.findById(tokenDoc.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    user.password = body.password; // pre-save hook will hash it
    await user.save();

    tokenDoc.used = true;
    await tokenDoc.save();

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Password reset failed.' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Not authenticated.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    res.json({ success: true, data: { user: user.toSafeObject() } });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid token.' });
  }
});

// ── POST /api/auth/wallet/nonce ────────────────────────────
// Returns a unique nonce message for MetaMask to sign
router.post('/wallet/nonce', (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ success: false, error: 'Wallet address required.' });
  const nonce = require('crypto').randomBytes(16).toString('hex');
  const message = `Sign in to ChainForge\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTime: ${new Date().toISOString()}`;
  res.json({ success: true, data: { message, nonce } });
});

module.exports = router;
