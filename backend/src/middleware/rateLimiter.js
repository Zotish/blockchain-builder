/**
 * ChainForge — Rate Limiting Middleware
 *
 * Different limits for different route groups.
 */
const rateLimit = require('express-rate-limit');

const windowMs = 15 * 60 * 1000; // 15 minutes

// ── General API limit ─────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// ── Auth endpoints (strict) ───────────────────────────────
const authLimiter = rateLimit({
  windowMs,
  max: 20, // 20 login/register attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Please wait 15 minutes.' },
});

// ── Deployment (very strict — expensive operations) ───────
const deployLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 deploys per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Deployment limit reached. Please wait before deploying again.' },
});

// ── Payment ───────────────────────────────────────────────
const paymentLimiter = rateLimit({
  windowMs,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many payment requests.' },
});

module.exports = { generalLimiter, authLimiter, deployLimiter, paymentLimiter };
