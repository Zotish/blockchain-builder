const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const router = express.Router();

// ── POST /api/auth/register ───────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, username, walletAddress } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and username are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists.',
      });
    }

    const user = await User.create({
      email,
      password,
      username,
      walletAddress: walletAddress || null,
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    res.status(201).json({
      success: true,
      data: { user: user.toSafeObject(), token },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Registration failed.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required.' });
    }

    // Select password explicitly (it's excluded by default)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    res.json({ success: true, data: { user: user.toSafeObject(), token } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────
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
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token.' });
  }
});

// ── POST /api/auth/wallet ────────────────────────────────
router.post('/wallet', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ success: false, error: 'Wallet address required.' });
    }

    const addr = walletAddress.toLowerCase();
    let user = await User.findOne({ walletAddress: addr });

    if (!user) {
      user = await User.create({
        email: `${addr.slice(0, 10)}@wallet.chainforge`,
        password: Math.random().toString(36) + Math.random().toString(36),
        username: `user_${addr.slice(2, 8)}`,
        walletAddress: addr,
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      config.jwtSecret,
      { expiresIn: config.jwtExpiry }
    );

    res.json({ success: true, data: { user: user.toSafeObject(), token } });
  } catch (err) {
    console.error('Wallet auth error:', err);
    res.status(500).json({ success: false, error: 'Wallet authentication failed.' });
  }
});

module.exports = router;
