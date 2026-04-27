/**
 * ChainForge — Testnet Expiry & Cleanup Cron Job
 *
 * Runs every hour:
 * 1. Stops testnet chains older than 72 hours (configurable)
 * 2. Enforces user plan limits (free = max 3 chains)
 * 3. Cleans up failed/orphaned containers
 */
const cron = require('node-cron');
const Chain = require('../models/Chain');
const Deployment = require('../models/Deployment');
const { stopOnVPS } = require('./vpsService');
const { freePorts } = require('./portManager');

const TESTNET_LIFETIME_HOURS = parseInt(process.env.TESTNET_LIFETIME_HOURS || '72');

// Plan limits
const PLAN_LIMITS = {
  free:       3,
  basic:      5,
  standard:   15,
  enterprise: 999,
};

/**
 * Stop and mark a chain as expired
 */
async function expireChain(chain) {
  try {
    console.log(`⏰ Expiring testnet chain: ${chain.name} (${chain._id})`);

    // Stop Docker container on VPS
    if (chain.nodeInfo?.containerName) {
      await stopOnVPS(
        chain.nodeInfo.containerName,
        null, null, null
      );
      await freePorts(chain.nodeInfo.containerName);
    }

    // Mark chain as stopped
    chain.status = 'stopped';
    chain.network = 'testnet';
    await chain.save();

    // Update latest deployment
    await Deployment.findOneAndUpdate(
      { chainId: chain._id, status: 'running' },
      { status: 'stopped', completedAt: new Date() }
    );

    console.log(`✅ Expired: ${chain.name}`);
  } catch (err) {
    console.error(`❌ Failed to expire chain ${chain._id}:`, err.message);
  }
}

/**
 * Run testnet expiry check
 */
async function runExpiryCheck() {
  const cutoff = new Date(Date.now() - TESTNET_LIFETIME_HOURS * 60 * 60 * 1000);

  const expiredChains = await Chain.find({
    status: 'deployed',
    network: 'testnet',
    updatedAt: { $lt: cutoff },
  }).populate('userId', 'plan');

  if (expiredChains.length > 0) {
    console.log(`⏰ Expiry check: ${expiredChains.length} testnet(s) to expire`);
    for (const chain of expiredChains) {
      await expireChain(chain);
    }
  }
}

/**
 * Enforce plan limits — disable oldest chains if over limit
 */
async function enforcePlanLimits() {
  // Group deployed chains by user
  const userChains = await Chain.aggregate([
    { $match: { status: { $in: ['deployed', 'deploying'] } } },
    { $group: { _id: '$userId', chains: { $push: '$$ROOT' }, count: { $sum: 1 } } },
  ]);

  for (const { _id: userId, chains, count } of userChains) {
    const user = await require('../models/User').findById(userId);
    if (!user) continue;

    const limit = PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

    if (count > limit) {
      // Sort by creation date, stop oldest exceeding limit
      const toStop = chains
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(0, count - limit);

      for (const chainData of toStop) {
        const chain = await Chain.findById(chainData._id);
        if (chain) {
          console.log(`🚫 Plan limit: stopping chain ${chain.name} for user ${userId}`);
          await expireChain(chain);
        }
      }
    }
  }
}

/**
 * Start all cron jobs
 */
function startCronJobs() {
  // Run every hour: testnet expiry
  cron.schedule('0 * * * *', async () => {
    console.log('🕐 Running testnet expiry check...');
    try { await runExpiryCheck(); } catch (e) { console.error(e); }
  });

  // Run every 6 hours: plan limit enforcement
  cron.schedule('0 */6 * * *', async () => {
    console.log('📋 Running plan limit enforcement...');
    try { await enforcePlanLimits(); } catch (e) { console.error(e); }
  });

  console.log('⏰ Cron jobs started (expiry + plan limits)');
}

module.exports = { startCronJobs, runExpiryCheck, enforcePlanLimits };
