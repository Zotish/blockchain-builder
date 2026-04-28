const express = require('express');
const authMiddleware = require('../middleware/auth');
const { validate, createChainSchema } = require('../middleware/validate');
const Chain = require('../models/Chain');
const Deployment = require('../models/Deployment');
const User = require('../models/User');
const config = require('../config');

// Plan limits from config (fallback if config not loaded)
const PLAN_LIMITS = config.plans || {
  free:       { testnets: 1, mainnets: 0, validatorNodes: 0 },
  basic:      { testnets: 3, mainnets: 1, validatorNodes: 1 },
  standard:   { testnets: 10, mainnets: 2, validatorNodes: 3 },
  enterprise: { testnets: 50, mainnets: 5, validatorNodes: 10 },
};

const router = express.Router();


// ── GET /api/chains ──────────────────────────────────────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const chains = await Chain.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: { chains, total: chains.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch chains.' });
  }
});

// ── GET /api/chains/public/:id ──────────────────────────
router.get('/public/:id', async (req, res) => {
  try {
    const chain = await Chain.findById(req.params.id).select('-config.genesisData'); // Exclude heavy data if any
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    // Only return limited info for public
    const publicChain = {
      _id: chain._id,
      name: chain.name,
      type: chain.type,
      network: chain.network,
      status: chain.status,
      config: {
        chainId: chain.config?.chainId,
        blockTime: chain.config?.blockTime,
        consensus: chain.config?.consensus,
        symbol: chain.config?.symbol,
      },
      token: chain.token,
      endpoints: chain.endpoints,
    };

    res.json({ success: true, data: { chain: publicChain } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch public chain info.' });
  }
});

// ── GET /api/chains/:id ──────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.id, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    const deployments = await Deployment.find({ chainId: chain._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: { chain, deployments } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch chain.' });
  }
});

// ── POST /api/chains ─────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const body = validate(req, res, createChainSchema);
  if (!body) return;

  try {
    const user = await User.findById(req.userId);
    const plan = user?.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    // Count existing chains by network type
    const testnetCount = await Chain.countDocuments({ userId: req.userId, network: { $ne: 'mainnet' } });
    const mainnetCount = await Chain.countDocuments({ userId: req.userId, network: 'mainnet' });

    const isMainnet = body.network === 'mainnet';

    if (isMainnet) {
      if (mainnetCount >= limits.mainnets) {
        return res.status(403).json({
          success: false,
          error: `Your ${plan} plan allows max ${limits.mainnets} mainnet(s). Upgrade or purchase add-ons.`,
          currentCount: mainnetCount,
          limit: limits.mainnets,
        });
      }
    } else {
      if (testnetCount >= limits.testnets) {
        return res.status(403).json({
          success: false,
          error: `Your ${plan} plan allows max ${limits.testnets} testnet(s). Upgrade to create more.`,
          currentCount: testnetCount,
          limit: limits.testnets,
        });
      }
    }

    const { name, type, template, chainId, symbol, consensus, blockTime, blockGasLimit, networkType, token, governance, customConfig } = body;

    const chain = await Chain.create({
      userId: req.userId,
      name,
      type,
      template: template || null,
      config: {
        chainId: chainId || Math.floor(Math.random() * 900000) + 10000,
        symbol: symbol || 'TOKEN',
        consensus: consensus || 'poa',
        blockTime: blockTime || 5,
        blockGasLimit: blockGasLimit || '30000000',
        networkType: networkType || 'public',
      },
      token: token || { name: `${name} Token`, symbol: symbol || 'TOKEN', decimals: 18, totalSupply: '1000000000' },
      governance: governance || { type: 'admin', votingPeriod: 86400, quorum: 51 },
      customConfig: customConfig || {},
    });

    res.status(201).json({ success: true, data: { chain } });
  } catch (err) {
    console.error('Create chain error:', err);
    res.status(500).json({ success: false, error: 'Failed to create chain.' });
  }
});


// ── PUT /api/chains/:id ──────────────────────────────────
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.id, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });
    if (chain.status === 'deployed' && chain.network === 'mainnet') {
      return res.status(400).json({ success: false, error: 'Cannot modify a deployed mainnet chain.' });
    }

    Object.assign(chain, req.body);
    await chain.save();
    res.json({ success: true, data: { chain } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update chain.' });
  }
});

// ── DELETE /api/chains/:id ───────────────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });
    // Also clean up deployments
    await Deployment.deleteMany({ chainId: chain._id });
    res.json({ success: true, message: 'Chain deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete chain.' });
  }
});

// ── GET /api/chains/:id/genesis ─────────────────────────
router.get('/:id/genesis', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.id, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });
    res.json({ success: true, data: { genesis: generateGenesis(chain) } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate genesis config.' });
  }
});

// ── GET /api/chains/:id/stats ────────────────────────────
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.id, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });
    res.json({ success: true, data: { stats: chain.stats } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats.' });
  }
});

// ── GET /api/chains/:id/adapter ──────────────────────────
// Returns chain-specific wallet, address, and connection info
router.get('/:id/adapter', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.id, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    const { getChainAdapter } = require('../services/chainAdapters');
    const adapter = getChainAdapter(chain.type, chain.customConfig);

    res.json({
      success: true,
      data: {
        chainType: chain.type,
        walletName: adapter.walletName,
        walletIcon: adapter.walletIcon,
        walletUrl: adapter.walletUrl,
        addressFormat: adapter.addressFormat,
        addressPlaceholder: adapter.addressPlaceholder,
        connectCode: (adapter.connectWalletCode || '')
          .replace(/CHAIN_ID_HEX/g, '0x' + (chain.config?.chainId || 1337).toString(16))
          .replace(/CHAIN_ID/g, String(chain.config?.chainId || chain.name))
          .replace(/CHAIN_NAME/g, chain.name)
          .replace(/RPC_URL/g, chain.endpoints?.rpc || 'http://localhost:8545')
          .replace(/WS_URL/g, chain.endpoints?.ws || 'ws://localhost:8546')
          .replace(/REST_URL/g, chain.endpoints?.rest || chain.endpoints?.rpc || '')
          .replace(/SYMBOL/g, chain.token?.symbol || chain.config?.symbol || 'TOKEN'),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch adapter info.' });
  }
});

function generateGenesis(chain) {
  if (chain.type === 'evm') {
    return {
      config: {
        chainId: chain.config.chainId,
        homesteadBlock: 0,
        eip150Block: 0,
        eip155Block: 0,
        eip158Block: 0,
        byzantiumBlock: 0,
        constantinopleBlock: 0,
        petersburgBlock: 0,
        istanbulBlock: 0,
        berlinBlock: 0,
        londonBlock: 0,
        clique: chain.config.consensus === 'poa'
          ? { period: chain.config.blockTime, epoch: 30000 }
          : undefined,
      },
      difficulty: chain.config.consensus === 'poa' ? '0x1' : '0x20000',
      gasLimit: `0x${parseInt(chain.config.blockGasLimit).toString(16)}`,
      alloc: {},
      coinbase: '0x0000000000000000000000000000000000000000',
      extradata: chain.config.consensus === 'poa'
        ? '0x' + '0'.repeat(64) + '0000000000000000000000000000000000000001' + '0'.repeat(130)
        : '0x',
      nonce: '0x0000000000000042',
      timestamp: '0x00',
    };
  }
  return {
    chainName: chain.name,
    chainId: chain.config.chainId,
    consensus: chain.config.consensus,
    blockTime: chain.config.blockTime,
    token: chain.token,
  };
}

module.exports = router;
