const express = require('express');
const authMiddleware = require('../middleware/auth');
const Chain = require('../models/Chain');
const Deployment = require('../models/Deployment');

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
  try {
    const {
      name, type, template, chainId, symbol, consensus,
      blockTime, blockGasLimit, networkType, token, governance, customConfig,
    } = req.body;

    if (!name || !type) {
      return res.status(400).json({ success: false, error: 'Chain name and type are required.' });
    }

    const chain = await Chain.create({
      userId: req.userId,
      name,
      type,
      template: template || null,
      config: {
        chainId: chainId || Math.floor(Math.random() * 90000) + 10000,
        symbol: symbol || 'TOKEN',
        consensus: consensus || 'poa',
        blockTime: blockTime || 5,
        blockGasLimit: blockGasLimit || '30000000',
        networkType: networkType || 'public',
      },
      token: token || {
        name: `${name} Token`,
        symbol: symbol || 'TOKEN',
        decimals: 18,
        totalSupply: '1000000000',
      },
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
