const express = require('express');
const Chain = require('../models/Chain');

const router = express.Router();

// ── POST /rpc/:chainId ──────────────────────────────────
// Proxy JSON-RPC requests to the actual Hetzner node to bypass MetaMask HTTPS restrictions.
router.post('/:chainId', async (req, res) => {
  try {
    const chain = await Chain.findById(req.params.chainId);
    if (!chain) return res.status(404).json({ error: 'Chain not found' });
    
    if (chain.status !== 'deployed' || !chain.endpoints?.rpc) {
      return res.status(503).json({ error: 'Chain node is offline or not deployed' });
    }

    const rpcUrl = chain.endpoints.rpc;

    // Forward the JSON-RPC request to the VPS node using native fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const data = await rpcRes.json();
    res.status(rpcRes.status).json(data);
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Gateway Timeout - Node did not respond in time' });
    }
    res.status(502).json({ error: 'Bad Gateway - Node might be unresponsive' });
  }
});

module.exports = router;
