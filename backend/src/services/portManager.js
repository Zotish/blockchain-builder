/**
 * ChainForge — Port Manager (MongoDB-backed)
 *
 * Replaces the in-memory Set with persistent MongoDB storage.
 * Server restarts no longer cause port conflicts.
 */
const PortAllocation = require('../models/PortAllocation');

const PORT_START = 9000;
const PORT_END   = 59000;
const PORT_STEP  = 10; // each chain uses a block of 10 ports

/**
 * Allocate unique ports for a new chain node
 */
async function allocatePorts(chainId, chainType, network, containerName) {
  // Find the highest allocated port in DB
  const last = await PortAllocation.findOne({ active: true }).sort({ rpcPort: -1 });
  let nextPort = last ? last.rpcPort + PORT_STEP : PORT_START;

  // Safety: don't go above PORT_END
  if (nextPort + 3 > PORT_END) {
    throw new Error('Port pool exhausted. Please free some chain resources.');
  }

  const rpcPort = nextPort;
  const wsPort  = nextPort + 1;
  const p2pPort = nextPort + 3;

  // Save to DB
  await PortAllocation.create({
    chainId,
    containerName,
    rpcPort,
    wsPort,
    p2pPort,
    chainType,
    network,
    active: true,
  });

  return { rpcPort, wsPort, p2pPort };
}

/**
 * Free ports when a chain is stopped/deleted
 */
async function freePorts(containerName) {
  await PortAllocation.findOneAndUpdate(
    { containerName },
    { active: false }
  );
}

/**
 * Get existing ports for a container (e.g., on restart)
 */
async function getPortsForContainer(containerName) {
  const alloc = await PortAllocation.findOne({ containerName, active: true });
  if (!alloc) return null;
  return {
    rpcPort: alloc.rpcPort,
    wsPort:  alloc.wsPort,
    p2pPort: alloc.p2pPort,
  };
}

module.exports = { allocatePorts, freePorts, getPortsForContainer };
