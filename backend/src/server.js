require('dotenv').config();

// ── Sentry v8 (error tracking) — init FIRST ─────────────────
// Sentry v8 removed Handlers.requestHandler/errorHandler
// Use setupExpressErrorHandler instead
let Sentry = null;
try {
  if (process.env.SENTRY_DSN) {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.2,
    });
    console.log('🔭 Sentry error tracking initialized');
  }
} catch (e) {
  console.warn('⚠️  Sentry init failed (non-fatal):', e.message);
  Sentry = null;
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const { connectDB } = require('./config/db');
const { generalLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const chainRoutes = require('./routes/chains');
const templateRoutes = require('./routes/templates');
const deployRoutes = require('./routes/deploy');
const paymentRoutes = require('./routes/payment');
const faucetRoutes = require('./routes/faucet');
const rpcRoutes = require('./routes/rpc');
const adminRoutes = require('./routes/admin');
const tempAdminRoutes = require('./routes/temp-admin');

// Services
const { startChainMonitor } = require('./services/chainMonitor');
const { startCronJobs } = require('./services/cronService');
const User = require('./models/User');

// Auto-set Admin from Env
async function initAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      console.log(`🔍 Attempting to set admin for: ${adminEmail}`);
      const user = await User.findOneAndUpdate(
        { email: adminEmail.trim().toLowerCase() },
        { role: 'admin' },
        { new: true }
      );
      if (user) {
        console.log(`👑 SUCCESS: ${adminEmail} is now an ADMIN in the database.`);
      } else {
        console.warn(`⚠️  WARNING: User with email ${adminEmail} not found in database.`);
      }
    } catch (err) {
      console.error('❌ CRITICAL: Failed to init admin:', err.message);
    }
  } else {
    console.log('ℹ️  No ADMIN_EMAIL environment variable found.');
  }
}

/**
 * Emergency Fix: Repair duplicate ports in existing chains
 */
async function repairPorts() {
  const Chain = require('./models/Chain');
  const { allocatePorts } = require('./services/portManager');
  const PortAllocation = require('./models/PortAllocation');

  try {
    console.log('🛠️  Running Port Repair Script...');
    const chains = await Chain.find({ status: 'deployed' });
    
    // Clear old allocations to start fresh and avoid conflicts during repair
    await PortAllocation.deleteMany({});

    for (const chain of chains) {
      const containerName = chain.endpoints?.containerName || `cf-${chain.network || 'testnet'}-${chain._id.toString().slice(-8)}`;
      
      const newPorts = await allocatePorts(
        chain._id,
        chain.type,
        chain.network || 'testnet',
        containerName
      );

      chain.endpoints = {
        ...chain.endpoints,
        ...newPorts,
        rpc: `http://${chain.endpoints?.vpsHost || 'localhost'}:${newPorts.rpcPort}`
      };

      await chain.save();
      console.log(`✅ Repaired ports for: ${chain.name} -> RPC: ${newPorts.rpcPort}`);
    }
    console.log('✨ Port Repair Completed.');
  } catch (err) {
    console.error('❌ Port Repair failed:', err.message);
  }
}

/**
 * Deep Clean: Remove files and containers that are not in the DB
 */
async function cleanOrphanedResources() {
  const Chain = require('./models/Chain');
  const { getSSHConnection, runOnVPS, getVPSConfig } = require('./services/vpsService');
  const vpsConfig = getVPSConfig();
  
  if (!vpsConfig) return;

  try {
    console.log('🧹 Starting VPS Deep Clean...');
    const ssh = await getSSHConnection(vpsConfig);
    const activeChains = await Chain.find({});
    const activeNames = new Set();
    
    activeChains.forEach(c => {
      const idStr = c._id.toString().slice(-8);
      activeNames.add(`cf-testnet-${idStr}`);
      activeNames.add(`cf-mainnet-${idStr}`);
    });

    // 1. Prune all unused Docker resources
    await runOnVPS(ssh, 'docker system prune -a -f --volumes', { allowFail: true });

    // 2. Stop and remove orphaned running containers
    const runningStr = await runOnVPS(ssh, "docker ps --format '{{.Names}}'", { allowFail: true });
    const runningContainers = runningStr.split(/\s+/).filter(name => name.startsWith('cf-'));
    
    for (const name of runningContainers) {
      if (!activeNames.has(name)) {
        console.log(`🛑 Stopping orphaned container: ${name}`);
        await runOnVPS(ssh, `docker stop ${name} && docker rm ${name}`, { allowFail: true });
      }
    }

    // 3. Remove orphaned data directories
    const foldersStr = await runOnVPS(ssh, 'ls /data/chainforge', { allowFail: true });
    const folders = foldersStr.split(/\s+/).filter(f => f.startsWith('cf-'));

    for (const folder of folders) {
      if (!activeNames.has(folder)) {
        console.log(`🗑️  Removing orphaned folder: ${folder}`);
        await runOnVPS(ssh, `rm -rf /data/chainforge/${folder}`, { allowFail: true });
      }
    }
    console.log('✨ VPS Deep Clean Completed.');
  } catch (err) {
    console.error('❌ VPS Deep Clean failed:', err.message);
  }
}

const app = express();

// Railway runs behind a load balancer — trust proxy for rate limiting
app.set('trust proxy', 1);
const server = http.createServer(app);

// ── Allowed origins ──────────────────────────────────────
const allowedOrigins = [
  'https://blockchain-engineering.netlify.app',
  'http://localhost:3000',
  'https://localhost:3000',
  config.corsOrigin
].filter(Boolean);

// ── CORS & Security (ULTIMATE PERMISSIVE) ────────────────
app.use(cors()); // Allows everything
app.use(helmet({ contentSecurityPolicy: false }));

// ── Socket.io ────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
});
app.set('io', io);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Global rate limit (200 req/15min per IP)
app.use('/api/', generalLimiter);

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/chains',    chainRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/deploy',    deployRoutes);
app.use('/api/payment',   paymentRoutes);
app.use('/api/faucet',    faucetRoutes);
app.use('/api/rpc',       rpcRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/setup-admin', tempAdminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    service: 'ChainForge API',
    version: '1.0.0',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── WebSocket ─────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('subscribe:deployment', (id) => socket.join(`deployment:${id}`));
  socket.on('subscribe:chain',      (id) => socket.join(`chain:${id}`));
  socket.on('unsubscribe:chain',    (id) => socket.leave(`chain:${id}`));
  socket.on('disconnect', () => {});
});

// ── Error Handlers ────────────────────────────────────────
// Sentry v8: use setupExpressErrorHandler instead of Handlers.errorHandler
if (Sentry && typeof Sentry.setupExpressErrorHandler === 'function') {
  Sentry.setupExpressErrorHandler(app);
}

app.use((err, req, res, next) => {
  if (Sentry) Sentry.captureException(err);
  console.error('❌ Error:', err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
});

// ── Bootstrap ─────────────────────────────────────────────
async function bootstrap() {
  try {
    await connectDB(config.mongoUri);
    await initAdmin();
    await repairPorts();
    await cleanOrphanedResources(); // Wipe out old data from deleted chains
  } catch {
    console.warn('⚠️  Running WITHOUT MongoDB.');
  }

  server.listen(config.port, '0.0.0.0', () => {
    console.log(`
  ╔══════════════════════════════════════════════╗
  ║   ⛓️  ChainForge API — Production Ready      ║
  ║   🚀 Port: ${String(config.port).padEnd(5)}                         ║
  ║   🌿 ENV:  ${String(process.env.NODE_ENV || 'development').padEnd(11)}                  ║
  ║   📡 WebSocket enabled                       ║
  ║   🔭 Sentry: ${process.env.SENTRY_DSN ? 'ON ' : 'OFF'}                           ║
  ╚══════════════════════════════════════════════╝
    `);
  });

  startChainMonitor(io);
  startCronJobs();      // testnet expiry + plan limits
}

bootstrap();

module.exports = { app, server, io };
