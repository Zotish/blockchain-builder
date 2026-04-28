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

// Services
const { startChainMonitor } = require('./services/chainMonitor');
const { startCronJobs } = require('./services/cronService');

const app = express();
const server = http.createServer(app);

// ── Allowed origins ──────────────────────────────────────
const allowedOrigins = [
  config.corsOrigin,
  'http://localhost:3000',
  'https://localhost:3000',
].filter(Boolean);

// ── Socket.io ────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
});
app.set('io', io);

// ── Middleware ────────────────────────────────────────────
// Sentry v8: requestHandler removed — tracing handled automatically via init

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
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
