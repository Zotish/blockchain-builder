const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chain',
      required: true,
    },
    plan: {
      type: String,
      enum: ['basic', 'standard', 'enterprise'],
      required: true,
    },
    amount: { type: String, required: true }, // In ETH/token
    currency: {
      type: String,
      enum: ['ETH', 'BNB', 'MATIC', 'USDT', 'USDC'],
      default: 'ETH',
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentWallet: { type: String, required: true },
    txHash: { type: String, default: null },
    confirmedAt: { type: Date, default: null },
    expiresAt: { type: Date },
    network: { type: String }, // which blockchain network the payment was on
    blockNumber: { type: Number },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ txHash: 1 }, { sparse: true });

module.exports = mongoose.model('Payment', paymentSchema);
