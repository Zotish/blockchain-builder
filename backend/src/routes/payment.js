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

// ── Live price fetcher (CoinGecko free API) ───────────────
// Cache prices for 5 minutes to avoid rate limits
const priceCache = { data: null, fetchedAt: 0 };

async function getLivePrices() {
  const now = Date.now();
  if (priceCache.data && now - priceCache.fetchedAt < 5 * 60 * 1000) {
    return priceCache.data;
  }
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,binancecoin,matic-network,tether,usd-coin,solana&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    const json = await res.json();
    const prices = {
      ETH:  json['ethereum']?.usd      || 3000,
      BTC:  json['bitcoin']?.usd       || 60000,
      BNB:  json['binancecoin']?.usd   || 400,
      MATIC:json['matic-network']?.usd || 1,
      USDT: json['tether']?.usd        || 1,
      USDC: json['usd-coin']?.usd      || 1,
      SOL:  json['solana']?.usd        || 150,
    };
    priceCache.data = prices;
    priceCache.fetchedAt = now;
    return prices;
  } catch {
    // Fallback static prices if API fails
    return { ETH: 3000, BTC: 60000, BNB: 400, MATIC: 1, USDT: 1, USDC: 1, SOL: 150 };
  }
}

// Convert ETH amount to any currency
async function convertFromEth(ethAmount, targetCurrency) {
  const prices = await getLivePrices();
  const ethUsd = prices['ETH'];
  const targetUsd = prices[targetCurrency] || ethUsd;
  const usdAmount = parseFloat(ethAmount) * ethUsd;
  return (usdAmount / targetUsd).toFixed(6);
}

// ── GET /api/payment/pricing ──────────────────────────────
router.get('/pricing', async (req, res) => {
  try {
    const prices = await getLivePrices();
    const { plans, pricing } = config;

    // Build plan details with BTC + USD equivalents
    const planDetails = {};
    for (const [planId, planCfg] of Object.entries(pricing.plans)) {
      const ethPrice = planCfg.eth;
      const usdPrice = (parseFloat(ethPrice) * prices.ETH).toFixed(2);
      const btcPrice = (parseFloat(ethPrice) * prices.ETH / prices.BTC).toFixed(6);
      planDetails[planId] = {
        ethPrice,
        btcPrice,
        usdPrice,
        mainnets:       plans[planId].mainnets,
        testnets:       plans[planId].testnets,
        validatorNodes: plans[planId].validatorNodes,
      };
    }

    res.json({
      success: true,
      data: {
        plans: {
          free: {
            ethPrice: '0', btcPrice: '0', usdPrice: '0',
            mainnets: 0, testnets: 1, validatorNodes: 0,
            label: 'Free', features: ['1 Testnet', '72h lifetime', 'No mainnet'],
          },
          basic: {
            ...planDetails.basic,
            label: 'Basic',
            features: ['1 Mainnet', '1 Validator Node', '3 Testnets', '30-day SLA'],
          },
          standard: {
            ...planDetails.standard,
            label: 'Standard',
            features: ['2 Mainnets', '3 Validator Nodes', '10 Testnets', '90-day SLA', 'Priority Support'],
          },
          enterprise: {
            ...planDetails.enterprise,
            label: 'Enterprise',
            features: ['5 Mainnets', '10 Validator Nodes', '50 Testnets', '1-year SLA', '24/7 Support', 'Custom Domain'],
          },
        },
        addons: {
          extraChain: {
            ethPrice: pricing.addons.extraChain,
            btcPrice: (parseFloat(pricing.addons.extraChain) * prices.ETH / prices.BTC).toFixed(6),
            usdPrice: (parseFloat(pricing.addons.extraChain) * prices.ETH).toFixed(2),
            label: '+1 Mainnet Chain',
          },
          extraNode: {
            ethPrice: pricing.addons.extraNode,
            btcPrice: (parseFloat(pricing.addons.extraNode) * prices.ETH / prices.BTC).toFixed(6),
            usdPrice: (parseFloat(pricing.addons.extraNode) * prices.ETH).toFixed(2),
            label: '+1 Validator Node',
          },
        },
        primaryCurrencies: pricing.primaryCurrencies,
        otherCurrencies: pricing.otherCurrencies,
        livePrices: prices,
        paymentWallet: config.paymentWallet,
        btcWallet: process.env.BTC_WALLET || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch pricing.' });
  }
});

// ── GET /api/payment/convert ──────────────────────────────
// Convert ETH amount to any supported currency
router.get('/convert', async (req, res) => {
  try {
    const { ethAmount, currency } = req.query;
    if (!ethAmount || !currency) {
      return res.status(400).json({ success: false, error: 'ethAmount and currency required.' });
    }
    const prices = await getLivePrices();
    const converted = await convertFromEth(ethAmount, currency.toUpperCase());
    const usdValue = (parseFloat(ethAmount) * prices.ETH).toFixed(2);
    res.json({
      success: true,
      data: {
        ethAmount,
        currency: currency.toUpperCase(),
        convertedAmount: converted,
        usdValue,
        rate: prices[currency.toUpperCase()] || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Conversion failed.' });
  }
});

// ── POST /api/payment/create ──────────────────────────────
router.post('/create', paymentLimiter, authMiddleware, async (req, res) => {
  try {
    const { chainId, plan, currency = 'ETH', extraChains = 0, extraNodes = 0 } = req.body;

    if (!chainId || !plan) {
      return res.status(400).json({ success: false, error: 'chainId and plan required.' });
    }

    // Validate plan
    const planPricing = config.pricing.plans[plan];
    if (!planPricing) {
      return res.status(400).json({ success: false, error: 'Invalid plan. Choose: basic, standard, enterprise.' });
    }

    const chain = await Chain.findOne({ _id: chainId, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    // Calculate total price in ETH
    const basePriceEth = parseFloat(planPricing.eth);
    const extraChainCost = parseFloat(config.pricing.addons.extraChain) * (extraChains || 0);
    const extraNodeCost  = parseFloat(config.pricing.addons.extraNode)  * (extraNodes  || 0);
    const totalEth = (basePriceEth + extraChainCost + extraNodeCost).toFixed(6);

    // Convert to selected currency
    const prices = await getLivePrices();
    let payAmount = totalEth;
    let payWallet = config.paymentWallet; // ETH wallet (0x...)

    if (currency === 'BTC') {
      payAmount = await convertFromEth(totalEth, 'BTC');
      payWallet = process.env.BTC_WALLET || 'BTC_WALLET_NOT_CONFIGURED';
    } else if (currency !== 'ETH') {
      // Other currencies — show equivalent but instruct to pay ETH value
      payAmount = await convertFromEth(totalEth, currency);
    }

    // Reuse pending payment if exists
    const existing = await Payment.findOne({
      chainId: chain._id, userId: req.userId,
      status: 'pending', expiresAt: { $gt: new Date() },
    });
    if (existing) {
      return res.json({ success: true, data: { payment: existing, payTo: payWallet, amount: payAmount, currency, totalEth } });
    }

    const payment = await Payment.create({
      userId:        req.userId,
      chainId:       chain._id,
      plan,
      amount:        totalEth,  // always store in ETH
      currency,
      paymentWallet: payWallet,
      extraChains,
      extraNodes,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    });

    res.status(201).json({
      success: true,
      data: {
        payment,
        payTo:    payWallet,
        amount:   payAmount,
        currency,
        totalEth,
        usdValue: (parseFloat(totalEth) * prices.ETH).toFixed(2),
        expiresIn: '30 minutes',
        instructions: `Send exactly ${payAmount} ${currency} to the wallet address shown.`,
        breakdown: {
          basePlan:    `${basePriceEth} ETH (${plan})`,
          extraChains: extraChains > 0 ? `+${extraChainCost} ETH (${extraChains} extra chains)` : null,
          extraNodes:  extraNodes  > 0 ? `+${extraNodeCost} ETH (${extraNodes} extra nodes)` : null,
          total:       `${totalEth} ETH`,
        },
      },
    });
  } catch (err) {
    console.error('Create payment error:', err);
    res.status(500).json({ success: false, error: 'Failed to create payment.' });
  }
});

// ── POST /api/payment/verify ──────────────────────────────
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
      return res.status(400).json({ success: false, error: 'Payment failed. Create a new one.' });
    }
    if (payment.expiresAt < new Date()) {
      payment.status = 'failed';
      await payment.save();
      return res.status(400).json({ success: false, error: 'Payment expired. Please create a new payment.' });
    }

    // Prevent double-spend
    const dup = await Payment.findOne({ txHash, _id: { $ne: payment._id } });
    if (dup) return res.status(400).json({ success: false, error: 'Transaction already used.' });

    // On-chain verification
    let verificationResult;
    try {
      verificationResult = await verifyPayment(txHash, payment.currency, payment.paymentWallet, payment.amount);
    } catch (verifyErr) {
      return res.status(400).json({ success: false, error: `Verification failed: ${verifyErr.message}` });
    }

    payment.status      = 'confirmed';
    payment.txHash      = txHash;
    payment.confirmedAt = new Date();
    payment.blockNumber = verificationResult.blockNumber;
    await payment.save();

    // Upgrade user plan + store addon info
    await User.findByIdAndUpdate(req.userId, {
      plan:           payment.plan,
      extraMainnets:  payment.extraChains || 0,
      extraNodes:     payment.extraNodes  || 0,
    });

    res.json({
      success: true,
      data: {
        payment,
        verification: verificationResult,
        message: `Payment verified! ${verificationResult.confirmations} confirmations. Plan upgraded to ${payment.plan}.`,
      },
    });
  } catch (err) {
    console.error('Verify payment error:', err);
    res.status(500).json({ success: false, error: 'Verification error. Please try again.' });
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

module.exports = router;
