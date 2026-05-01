/**
 * ChainForge — Zod Validation Schemas
 *
 * All input validation in one place.
 * Used by route handlers to validate request bodies.
 */
const { z } = require('zod');

// ── Auth ─────────────────────────────────────────────────
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username: only letters, numbers, _ and - allowed'),
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')
    .optional()
    .nullable(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

const walletAuthSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  signature: z.string().min(10, 'Signature required'),
  message: z.string().min(1, 'Message required'),
});

const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email'),
});

const passwordResetSchema = z.object({
  token: z.string().min(1, 'Token required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// ── Chain ─────────────────────────────────────────────────
const createChainSchema = z.object({
  name: z
    .string()
    .min(1, 'Chain name required')
    .max(60, 'Name too long')
    .regex(/^[a-zA-Z0-9 _\-\.]+$/, 'Invalid chain name'),
  type: z.enum(['evm', 'substrate', 'cosmos', 'hyperledger', 'solana', 'dag', 'custom']),
  template: z.string().optional().nullable(),
  chainId: z.number().int().min(1).max(999999999).optional(),
  symbol: z
    .string()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters/numbers')
    .optional(),
  consensus: z.string().optional(),
  blockTime: z.number().min(0).max(120).optional(),
  blockGasLimit: z.string().optional(),
  networkType: z.enum(['public', 'private', 'consortium']).optional(),
  token: z
    .object({
      name: z.string().max(60).optional(),
      symbol: z.string().max(10).optional(),
      decimals: z.number().int().min(0).max(18).optional(),
      totalSupply: z.string().optional(),
    })
    .optional(),
  governance: z
    .object({
      type: z.string().optional(),
      votingPeriod: z.number().int().min(60).optional(),
      quorum: z.number().int().min(1).max(100).optional(),
    })
    .optional(),
});

// ── Payment ───────────────────────────────────────────────
const createPaymentSchema = z.object({
  chainId: z.string().min(1, 'Chain ID required'),
  plan: z.enum(['basic', 'standard', 'enterprise']),
  currency: z.enum(['ETH', 'BNB', 'MATIC', 'USDT', 'USDC']).optional(),
});

const verifyPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID required'),
  txHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format'),
});

// ── Helpers ───────────────────────────────────────────────

/**
 * Validate request body and return 400 if invalid
 * Usage: const body = validate(req, res, schema); if (!body) return;
 */
function validate(req, res, schema) {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const errors = issues.map(e => `${(e.path || []).join('.')}: ${e.message}`);
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
    });
    return null;
  }
  return result.data;
}

module.exports = {
  registerSchema,
  loginSchema,
  walletAuthSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  createChainSchema,
  createPaymentSchema,
  verifyPaymentSchema,
  validate,
};
