const express = require('express');
const Chain = require('../models/Chain');

const router = express.Router();

// ── ALL /rpc/:chainId ──────────────────────────────────
// Proxy JSON-RPC (POST) and REST (GET) requests to the actual Hetzner node
router.all('/:chainId*', async (req, res) => {
  try {
    const chain = await Chain.findById(req.params.chainId);
    if (!chain) return res.status(404).json({ error: 'Chain not found' });
    
    if (chain.status !== 'deployed' || !chain.endpoints?.rpc) {
      return res.status(503).json({ error: 'Chain node is offline or not deployed' });
    }

    // Handle nested paths (e.g., /api/rpc/ID/block?height=1)
    const extraPath = req.params[0] || '';
    const rpcUrl = new URL(chain.endpoints.rpc + extraPath);
    
    // Forward query params
    Object.keys(req.query).forEach(key => rpcUrl.searchParams.append(key, req.query[key]));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const options = {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      options.body = JSON.stringify(req.body);
    }

    const rpcRes = await fetch(rpcUrl.toString(), options);
    clearTimeout(timeoutId);

    const contentType = rpcRes.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await rpcRes.json();
      res.status(rpcRes.status).json(data);
    } else {
      const text = await rpcRes.text();
      res.status(rpcRes.status).send(text);
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Gateway Timeout - Node did not respond in time' });
    }
    console.error('RPC Proxy Error:', err);
    res.status(502).json({ error: 'Bad Gateway - Node might be unresponsive' });
  }
});

module.exports = router;
