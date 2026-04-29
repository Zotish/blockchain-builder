const mongoose = require('mongoose');

/**
 * Tracks allocated ports for blockchain nodes.
 * Stored in MongoDB so server restarts don't lose port assignments.
 */
const portAllocationSchema = new mongoose.Schema(
  {
    chainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chain',
      required: true,
      index: true,
    },
    containerName: { type: String, required: true, unique: true },
    rpcPort:  { type: Number, required: true, unique: true },
    wsPort:   { type: Number, required: true, unique: true },
    p2pPort:  { type: Number, required: true },
    chainType: { type: String, required: true },
    network:   { type: String, enum: ['testnet', 'mainnet'], required: true },
    active:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Removed duplicate index to resolve warning
portAllocationSchema.index({ active: 1 });

module.exports = mongoose.model('PortAllocation', portAllocationSchema);
