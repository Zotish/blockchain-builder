const mongoose = require('mongoose');

const logEntrySchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const deploymentSchema = new mongoose.Schema(
  {
    chainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chain',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    network: {
      type: String,
      enum: ['testnet', 'mainnet'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'initializing', 'deploying', 'running', 'failed', 'stopped'],
      default: 'pending',
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    config: { type: mongoose.Schema.Types.Mixed },
    endpoints: {
      rpc: { type: String },
      ws: { type: String },
      explorer: { type: String },
    },
    nodeInfo: {
      nodeId: { type: String },
      peerId: { type: String },
      chainId: { type: Number },
      containerId: { type: String },
    },
    logs: [logEntrySchema],
    error: { type: String, default: null },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

deploymentSchema.index({ chainId: 1, createdAt: -1 });
deploymentSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Deployment', deploymentSchema);
