const express = require('express');
const authMiddleware = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const Chain = require('../models/Chain');
const { sendFaucetTokens } = require('../services/faucetService');

const router = express.Router();

// Rate limit faucet: 5 requests per 15 min per IP
const rateLimit = require('express-rate-limit');
const faucetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many faucet requests. Please wait.' },
});

// ── POST /api/faucet/:chainId ────────────────────────────
router.post('/:chainId', faucetLimiter, authMiddleware, async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res.status(400).json({ success: false, error: 'Wallet address required.' });
    }

    const chain = await Chain.findById(req.params.chainId);
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    const result = await sendFaucetTokens(chain, address, req.userId);

    res.json({
      success: true,
      data: {
        ...result,
        message: `${result.amount} ${result.symbol} sent to ${address}`,
      },
    });
  } catch (err) {
    console.error('Faucet error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
