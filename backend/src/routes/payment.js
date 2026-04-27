const express = require('express');
const authMiddleware = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');
const { validate, createPaymentSchema, verifyPaymentSchema } = require('../middleware/validate');
const Payment = require('../models/Payment');
const Chain = require('../models/Chain');
const User = require('../models/User');
const config = require('../config');
const { verifyPayment } = require('../services/paymentVerifier');

const router = express.Router();

// ── GET /api/payment/pricing ─────────────────────────────
router.get('/pricing', (req, res) => {
  res.json({
    success: true,
    data: {
      plans: {
        testnet: { price: '0', currency: 'FREE', label: 'Testnet', features: ['Free forever', '72h lifetime', '1 node'] },
        basic:   { price: config.pricing.basic,    currency: 'ETH', label: 'Basic',    features: ['1 Node', '30-day SLA', 'Basic support'] },
        standard:{ price: config.pricing.standard, currency: 'ETH', label: 'Standard', features: ['3 Nodes', '90-day SLA', 'Priority support', 'Block Explorer'] },
        enterprise:{ price: config.pricing.enterprise, currency: 'ETH', label: 'Enterprise', features: ['5+ Nodes', '1-year SLA', '24/7 support', 'Custom domain', 'Analytics'] },
      },
      acceptedCurrencies: ['ETH', 'BNB', 'MATIC', 'USDT', 'USDC'],
      paymentWallet: config.paymentWallet,
    },
  });
});

// ── POST /api/payment/create ──────────────────────────────
router.post('/create', authLimiterApply, authMiddleware, async (req, res) => {
  const body = validate(req, res, createPaymentSchema);
  if (!body) return;

  try {
    const { chainId, plan, currency } = body;

    const chain = await Chain.findOne({ _id: chainId, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    const price = config.pricing[plan];
    if (!price) return res.status(400).json({ success: false, error: 'Invalid plan.' });

    // Check for existing pending payment for this chain
    const existing = await Payment.findOne({
      chainId: chain._id,
      userId: req.userId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
    if (existing) {
      return res.json({
        success: true,
        data: { payment: existing, payTo: config.paymentWallet, amount: price, currency: currency || 'ETH' },
      });
    }

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
        instructions: `Send exactly ${price} ${currency || 'ETH'} to ${config.paymentWallet}`,
      },
    });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ success: false, error: 'Failed to create payment.' });
  }
});

// ── POST /api/payment/verify ──────────────────────────────
// 🔐 CRITICAL: verifies real blockchain transaction
router.post('/verify', paymentLimiter, authMiddleware, async (req, res) => {
  const body = validate(req, res, verifyPaymentSchema);
  if (!body) return;

  try {
    const { paymentId, txHash } = body;

    const payment = await Payment.findOne({ _id: paymentId, userId: req.userId });
    if (!payment) return res.status(404).json({ success: false, error: 'Payment not found.' });

    if (payment.status === 'confirmed') {
      return res.json({ success: true, data: { payment, message: 'Already confirmed.' } });
    }

    if (payment.status === 'failed') {
      return res.status(400).json({ success: false, error: 'This payment failed. Please create a new one.' });
    }

    if (payment.expiresAt < new Date()) {
      payment.status = 'failed';
      await payment.save();
      return res.status(400).json({ success: false, error: 'Payment expired. Please create a new payment.' });
    }

    // ── On-chain verification ─────────────────────────────
    let verificationResult;
    try {
      verificationResult = await verifyPayment(
        txHash,
        payment.currency,
        config.paymentWallet,
        payment.amount
      );
    } catch (verifyErr) {
      return res.status(400).json({
        success: false,
        error: `Payment verification failed: ${verifyErr.message}`,
      });
    }

    // Check if txHash was already used for another payment (prevent double-spend)
    const dupPayment = await Payment.findOne({ txHash, _id: { $ne: payment._id } });
    if (dupPayment) {
      return res.status(400).json({ success: false, error: 'This transaction was already used.' });
    }

    // Mark as confirmed
    payment.status = 'confirmed';
    payment.txHash = txHash;
    payment.confirmedAt = new Date();
    payment.blockNumber = verificationResult.blockNumber;
    payment.network = payment.currency;
    await payment.save();

    // Upgrade user plan
    await User.findByIdAndUpdate(req.userId, { plan: payment.plan });

    res.json({
      success: true,
      data: {
        payment,
        verification: verificationResult,
        message: `Payment verified on-chain! ${verificationResult.confirmations} confirmations.`,
      },
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, error: 'Verification service error. Please try again.' });
  }
});

// ── GET /api/payment/history ──────────────────────────────
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .populate('chainId', 'name type');
    res.json({ success: true, data: { payments, total: payments.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch history.' });
  }
});

function authLimiterApply(req, res, next) {
  paymentLimiter(req, res, next);
}

module.exports = router;
