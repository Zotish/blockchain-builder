const express = require('express');
const authMiddleware = require('../middleware/auth');
const Payment = require('../models/Payment');
const Chain = require('../models/Chain');
const config = require('../config');

const router = express.Router();

// ── GET /api/payment/pricing ─────────────────────────────
router.get('/pricing', (req, res) => {
  res.json({
    success: true,
    data: {
      pricing: {
        testnet: { price: '0', currency: 'FREE', description: 'Free testnet deployment' },
        basic: {
          price: config.pricing.basic,
          currency: 'ETH',
          description: 'Basic mainnet — 1 node',
          features: ['1 Node', 'Basic Support', '30-day SLA'],
        },
        standard: {
          price: config.pricing.standard,
          currency: 'ETH',
          description: 'Standard mainnet — 3 nodes',
          features: ['3 Nodes', 'Priority Support', '90-day SLA', 'Block Explorer'],
        },
        enterprise: {
          price: config.pricing.enterprise,
          currency: 'ETH',
          description: 'Enterprise — full infrastructure',
          features: ['5+ Nodes', '24/7 Support', '1-year SLA', 'Custom Domain', 'Analytics'],
        },
      },
      acceptedCurrencies: ['ETH', 'BNB', 'MATIC', 'USDT', 'USDC'],
      paymentWallet: config.paymentWallet,
    },
  });
});

// ── POST /api/payment/create ─────────────────────────────
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { chainId, plan, currency } = req.body;
    if (!chainId || !plan) {
      return res.status(400).json({ success: false, error: 'chainId and plan required.' });
    }

    const chain = await Chain.findOne({ _id: chainId, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    const price = config.pricing[plan];
    if (!price) return res.status(400).json({ success: false, error: 'Invalid plan.' });

    const payment = await Payment.create({
      userId: req.userId,
      chainId: chain._id,
      plan,
      amount: price,
      currency: currency || 'ETH',
      paymentWallet: config.paymentWallet,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    });

    res.status(201).json({
      success: true,
      data: {
        payment,
        payTo: config.paymentWallet,
        amount: price,
        currency: currency || 'ETH',
        expiresIn: '30 minutes',
      },
    });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ success: false, error: 'Failed to create payment.' });
  }
});

// ── POST /api/payment/verify ─────────────────────────────
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { paymentId, txHash } = req.body;
    if (!paymentId || !txHash) {
      return res.status(400).json({ success: false, error: 'paymentId and txHash required.' });
    }

    const payment = await Payment.findOne({ _id: paymentId, userId: req.userId });
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found.' });

    if (payment.status === 'confirmed') {
      return res.json({ success: true, data: { payment, message: 'Already confirmed.' } });
    }

    // TODO: In production, verify txHash on-chain via ethers.js
    // For now, mark as confirmed after receipt of hash
    payment.status = 'confirmed';
    payment.txHash = txHash;
    payment.confirmedAt = new Date();
    await payment.save();

    res.json({
      success: true,
      data: { payment, message: 'Payment verified. You can now deploy to mainnet.' },
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

// ── GET /api/payment/history ─────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .populate('chainId', 'name type');
    res.json({ success: true, data: { payments, total: payments.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch payment history.' });
  }
});

module.exports = router;
