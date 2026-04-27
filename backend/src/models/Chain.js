const mongoose = require('mongoose');

const chainSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['evm', 'substrate', 'cosmos', 'hyperledger', 'solana', 'dag', 'custom'],
    },
    template: { type: String, default: null },
    status: {
      type: String,
      enum: ['draft', 'deploying', 'deployed', 'failed', 'stopped'],
      default: 'draft',
    },
    network: {
      type: String,
      enum: ['testnet', 'mainnet'],
      default: 'testnet',
    },
    config: {
      chainId: { type: Number },
      symbol: { type: String, default: 'TOKEN' },
      consensus: { type: String, default: 'poa' },
      blockTime: { type: Number, default: 5 },
      blockGasLimit: { type: String, default: '30000000' },
      networkType: {
        type: String,
        enum: ['public', 'private', 'consortium'],
        default: 'public',
      },
    },
    token: {
      name: { type: String },
      symbol: { type: String },
      decimals: { type: Number, default: 18 },
      totalSupply: { type: String, default: '1000000000' },
    },
    governance: {
      type: { type: String, default: 'admin' },
      votingPeriod: { type: Number, default: 86400 },
      quorum: { type: Number, default: 51 },
    },
    customConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Live endpoint info (filled after deployment)
    endpoints: {
      rpc: { type: String },
      ws: { type: String },
      explorer: { type: String },
    },
    nodeInfo: {
      nodeId: { type: String },
      peerId: { type: String },
      containerId: { type: String }, // Docker container ID
      containerName: { type: String },
    },
    // Stats (updated periodically via WS monitor)
    stats: {
      blockHeight: { type: Number, default: 0 },
      txCount: { type: Number, default: 0 },
      peers: { type: Number, default: 0 },
      gasPrice: { type: String, default: '1000000000' },
      lastSeen: { type: Date },
    },
  },
  { timestamps: true }
);

// Index for fast user queries
chainSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Chain', chainSchema);
