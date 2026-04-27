const express = require('express');
const authMiddleware = require('../middleware/auth');
const Chain = require('../models/Chain');
const Deployment = require('../models/Deployment');
const Payment = require('../models/Payment');
const { deployChainNode, stopChainNode } = require('../services/dockerService');

const router = express.Router();

// ── POST /api/deploy/testnet/:chainId ────────────────────
router.post('/testnet/:chainId', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.chainId, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    // Create deployment record
    const deployment = await Deployment.create({
      chainId: chain._id,
      userId: req.userId,
      network: 'testnet',
      status: 'initializing',
      startedAt: new Date(),
      config: chain.config,
    });

    // Update chain status
    chain.status = 'deploying';
    chain.network = 'testnet';
    await chain.save();

    const io = req.app.get('io');

    // Kick off async deployment (non-blocking)
    runDeployment(deployment, chain, io, 'testnet').catch(console.error);

    res.status(202).json({
      success: true,
      data: {
        deployment,
        wsChannel: `deployment:${deployment._id}`,
        message: 'Testnet deployment initiated. Connect WebSocket for live logs.',
      },
    });
  } catch (err) {
    console.error('Deploy testnet error:', err);
    res.status(500).json({ success: false, error: 'Deployment failed to start.' });
  }
});

// ── POST /api/deploy/mainnet/:chainId ───────────────────
router.post('/mainnet/:chainId', authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.body;

    const chain = await Chain.findOne({ _id: req.params.chainId, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    if (!paymentId) {
      return res.status(400).json({ success: false, error: 'Payment is required for mainnet.' });
    }

    const payment = await Payment.findOne({ _id: paymentId, userId: req.userId });
    if (!payment || payment.status !== 'confirmed') {
      return res.status(400).json({ success: false, error: 'Confirmed payment required.' });
    }

    const deployment = await Deployment.create({
      chainId: chain._id,
      userId: req.userId,
      network: 'mainnet',
      status: 'initializing',
      paymentId: payment._id,
      startedAt: new Date(),
      config: chain.config,
    });

    chain.status = 'deploying';
    chain.network = 'mainnet';
    await chain.save();

    const io = req.app.get('io');
    runDeployment(deployment, chain, io, 'mainnet').catch(console.error);

    res.status(202).json({
      success: true,
      data: {
        deployment,
        wsChannel: `deployment:${deployment._id}`,
        message: 'Mainnet deployment initiated.',
      },
    });
  } catch (err) {
    console.error('Deploy mainnet error:', err);
    res.status(500).json({ success: false, error: 'Mainnet deployment failed to start.' });
  }
});

// ── GET /api/deploy/:id ──────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const deployment = await Deployment.findOne({ _id: req.params.id, userId: req.userId });
    if (!deployment) return res.status(404).json({ success: false, error: 'Deployment not found.' });
    res.json({ success: true, data: { deployment } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch deployment.' });
  }
});

// ── GET /api/deploy/chain/:chainId ──────────────────────
router.get('/chain/:chainId', authMiddleware, async (req, res) => {
  try {
    const deployments = await Deployment.find({ chainId: req.params.chainId, userId: req.userId })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: { deployments } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch deployments.' });
  }
});

// ── POST /api/deploy/stop/:chainId ──────────────────────
router.post('/stop/:chainId', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.chainId, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    // Stop Docker container
    if (chain.nodeInfo?.containerId) {
      await stopChainNode(chain.nodeInfo.containerId);
    }

    chain.status = 'stopped';
    await chain.save();

    res.json({ success: true, message: 'Chain stopped.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to stop chain.' });
  }
});

// ── Async deployment runner ──────────────────────────────
async function runDeployment(deployment, chain, io, network) {
  const emit = (event, data) => {
    io.to(`deployment:${deployment._id}`).emit(event, data);
  };

  const addLog = async (message, level = 'info') => {
    deployment.logs.push({ message, level, timestamp: new Date() });
    // Persist every few logs to avoid too many writes
    if (deployment.logs.length % 3 === 0) await deployment.save();
    emit('deployment:update', {
      deploymentId: deployment._id,
      log: message,
      progress: deployment.progress,
      status: deployment.status,
    });
  };

  try {
    deployment.status = 'deploying';
    await deployment.save();

    // ── Docker deployment ────────────────────────────────
    let progress = 0;
    const { containerId, containerName, rpcPort, wsPort } = await deployChainNode(
      chain,
      network,
      async (msg) => {
        progress = Math.min(progress + 11, 99);
        deployment.progress = progress;
        await addLog(msg);
      }
    );

    // ── Finalise ─────────────────────────────────────────
    const endpoints = {
      rpc: process.env.NODE_ENV === 'production'
        ? `https://${containerName}.chainforge.app`
        : `http://localhost:${rpcPort}`,
      ws: process.env.NODE_ENV === 'production'
        ? `wss://${containerName}.chainforge.app/ws`
        : `ws://localhost:${wsPort}`,
      explorer: process.env.NODE_ENV === 'production'
        ? `https://explorer-${containerName}.chainforge.app`
        : `http://localhost:${rpcPort + 100}`,
    };

    const nodeInfo = {
      nodeId: `chainforge-${chain._id.toString().slice(-8)}`,
      peerId: `16Uiu2HAm${Math.random().toString(36).slice(2, 15)}`,
      chainId: chain.config.chainId,
      containerId,
    };

    // Save deployment
    deployment.status = 'running';
    deployment.progress = 100;
    deployment.endpoints = endpoints;
    deployment.nodeInfo = nodeInfo;
    deployment.completedAt = new Date();
    await deployment.save();

    // Save chain
    chain.status = 'deployed';
    chain.network = network;
    chain.endpoints = endpoints;
    chain.nodeInfo = { ...nodeInfo, containerName };
    chain.stats = { blockHeight: 0, txCount: 0, peers: 0, gasPrice: '1000000000', lastSeen: new Date() };
    await chain.save();

    emit('deployment:complete', {
      deploymentId: deployment._id,
      status: 'running',
      endpoints,
      nodeInfo,
    });

    await addLog('🎉 Blockchain is live!');
  } catch (err) {
    console.error('Deployment runner error:', err);
    deployment.status = 'failed';
    deployment.error = err.message;
    await deployment.save();

    chain.status = 'failed';
    await chain.save();

    emit('deployment:failed', {
      deploymentId: deployment._id,
      error: err.message,
    });
  }
}

module.exports = router;
