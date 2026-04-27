require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const { connectDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const chainRoutes = require('./routes/chains');
const templateRoutes = require('./routes/templates');
const deployRoutes = require('./routes/deploy');
const paymentRoutes = require('./routes/payment');

// Import WebSocket monitor
const { startChainMonitor } = require('./services/chainMonitor');

const app = express();
const server = http.createServer(app);

// Socket.io — allow Railway/Netlify origins + local dev
const allowedOrigins = [
  config.corsOrigin,
  'http://localhost:3000',
  'https://localhost:3000',
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Make io available app-wide
app.set('io', io);

// ── Middleware ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/chains', chainRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/payment', paymentRoutes);

// Health check (used by Railway)
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

// ── WebSocket ───────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 WS connected: ${socket.id}`);

  // Subscribe to deployment progress
  socket.on('subscribe:deployment', (deploymentId) => {
    socket.join(`deployment:${deploymentId}`);
  });

  // Subscribe to real-time chain stats
  socket.on('subscribe:chain', (chainId) => {
    socket.join(`chain:${chainId}`);
  });

  // Unsubscribe
  socket.on('unsubscribe:chain', (chainId) => {
    socket.leave(`chain:${chainId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ WS disconnected: ${socket.id}`);
  });
});

// ── Error Handlers ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
  });
});

// ── Bootstrap ───────────────────────────────────────────────
async function bootstrap() {
  // Connect MongoDB
  try {
    await connectDB(config.mongoUri);
  } catch (err) {
    console.warn('⚠️  Running WITHOUT MongoDB — data will not persist.');
  }

  // Start HTTP + WS server
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`
  ╔══════════════════════════════════════════════╗
  ║                                              ║
  ║   ⛓️  ChainForge API Server                  ║
  ║   🚀 Running on port ${String(config.port).padEnd(5)}               ║
  ║   📡 WebSocket enabled                       ║
  ║   🌿 ENV: ${String(process.env.NODE_ENV || 'development').padEnd(11)}                 ║
  ║                                              ║
  ╚══════════════════════════════════════════════╝
    `);
  });

  // Start the real-time chain stats monitor
  startChainMonitor(io);
}

bootstrap();

module.exports = { app, server, io };
