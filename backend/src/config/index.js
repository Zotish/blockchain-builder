require('dotenv').config();

module.exports = {
  // Railway injects PORT automatically
  port: parseInt(process.env.PORT, 10) || 5001,

  // MongoDB — Railway plugin sets MONGO_URL or MONGODB_URL
  mongoUri:
    process.env.MONGO_URL ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URI ||
    'mongodb://localhost:27017/chainforge',

  jwtSecret: process.env.JWT_SECRET || 'chainforge-dev-secret-CHANGE-IN-PROD',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',

  // CORS — set to your Netlify URL in production
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // Blockchain defaults
  defaultChainId: 1337,
  maxTestnetsPerUser: 10,
  testnetLifetimeMs: 72 * 60 * 60 * 1000, // 72 hours

  // Payment wallet (your wallet address on Railway env)
  paymentWallet:
    process.env.PAYMENT_WALLET ||
    '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38',

  // Pricing in ETH
  pricing: {
    basic: '0.1',
    standard: '0.3',
    enterprise: '1.0',
    additionalNode: '0.05',
    customConsensus: '0.5',
  },

  // Docker (Railway service can run Docker-in-Docker or sidecar)
  dockerEnabled: process.env.DOCKER_ENABLED === 'true',
  dockerHost: process.env.DOCKER_HOST || '/var/run/docker.sock',

  // Chain monitor interval (ms)
  monitorInterval: parseInt(process.env.MONITOR_INTERVAL, 10) || 10000,
};
