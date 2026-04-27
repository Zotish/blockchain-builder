const express = require('express');
const authMiddleware = require('../middleware/auth');
const Chain = require('../models/Chain');
const Deployment = require('../models/Deployment');
const Payment = require('../models/Payment');
const { deployChainNode, stopChainNode } = require('../services/dockerService');
const { deployOnVPS, stopOnVPS, getContainerLogs, getContainerStatus, isVPSAvailable } = require('../services/vpsService');

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

// ── GET /api/deploy/logs/:chainId ───────────────────────
router.get('/logs/:chainId', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.chainId, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    const logs = await getContainerLogs(chain.nodeInfo?.containerName, 100);
    res.json({ success: true, data: { logs } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch logs.' });
  }
});

// ── GET /api/deploy/status/:chainId ─────────────────────
router.get('/status/:chainId', authMiddleware, async (req, res) => {
  try {
    const chain = await Chain.findOne({ _id: req.params.chainId, userId: req.userId });
    if (!chain) return res.status(404).json({ success: false, error: 'Chain not found.' });

    const status = await getContainerStatus(chain.nodeInfo?.containerName);
    res.json({ success: true, data: { status, chain: chain.status } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch status.' });
  }
});

// ── Async deployment runner ──────────────────────────────
async function runDeployment(deployment, chain, io, network) {
  const emit = (event, data) => {
    io.to(`deployment:${deployment._id}`).emit(event, data);
  };

  let progress = 0;

  const addLog = async (message, level = 'info') => {
    progress = Math.min(progress + 11, 99);
    deployment.logs.push({ message, level, timestamp: new Date() });
    deployment.progress = progress;
    if (deployment.logs.length % 3 === 0) await deployment.save();
    emit('deployment:update', {
      deploymentId: deployment._id,
      log: message,
      progress,
      status: deployment.status,
    });
  };

  try {
    deployment.status = 'deploying';
    await deployment.save();

    // ── Choose deployment strategy ────────────────────────
    // Priority: 1) Hetzner VPS  2) Local Docker  3) Simulation
    let result;
    const vpsReady = await isVPSAvailable();

    if (vpsReady) {
      // 🏆 REAL deployment on Hetzner VPS
      result = await deployOnVPS(chain, network, addLog);
    } else {
      // Fallback: local Docker or simulation
      result = await deployChainNode(chain, network, addLog);
    }

    const { containerId, containerName, rpcPort, wsPort, vpsHost } = result;

    // ── Build public endpoints ─────────────────────────────
    // If on VPS → use VPS IP. If local → localhost
    const host = vpsHost || process.env.VPS_HOST || 'localhost';
    const endpoints = {
      rpc: `http://${host}:${rpcPort}`,
      ws: `ws://${host}:${wsPort}`,
      explorer: `http://${host}:${rpcPort + 100}`,
    };

    const nodeInfo = {
      nodeId: `chainforge-${chain._id.toString().slice(-8)}`,
      peerId: `16Uiu2HAm${Math.random().toString(36).slice(2, 15)}`,
      chainId: chain.config?.chainId,
      containerId,
      containerName,
    };

    // Persist
    deployment.status = 'running';
    deployment.progress = 100;
    deployment.endpoints = endpoints;
    deployment.nodeInfo = nodeInfo;
    deployment.completedAt = new Date();
    await deployment.save();

    chain.status = 'deployed';
    chain.network = network;
    chain.endpoints = endpoints;
    chain.nodeInfo = { ...nodeInfo, containerName };
    chain.stats = {
      blockHeight: 0, txCount: 0, peers: 0,
      gasPrice: '1000000000', lastSeen: new Date(),
    };
    await chain.save();

    progress = 100;
    await addLog('🎉 Blockchain is live!');

    emit('deployment:complete', {
      deploymentId: deployment._id,
      status: 'running',
      endpoints,
      nodeInfo,
      deployedOn: vpsReady ? 'vps' : 'simulation',
    });

  } catch (err) {
    console.error('Deployment error:', err);
    deployment.status = 'failed';
    deployment.error = err.message;
    await deployment.save();
    chain.status = 'failed';
    await chain.save();
    emit('deployment:failed', { deploymentId: deployment._id, error: err.message });
  }
}

module.exports = router;
