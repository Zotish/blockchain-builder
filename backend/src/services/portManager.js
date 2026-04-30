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
  let rpcPort = PORT_START;
  let wsPort, p2pPort;
  let collision = true;

  // Loop until we find a block of ports that is not in use
  while (collision) {
    const existing = await PortAllocation.findOne({ 
      active: true, 
      $or: [
        { rpcPort: rpcPort },
        { wsPort:  rpcPort + 1 },
        { p2pPort: rpcPort + 3 }
      ]
    });

    if (!existing) {
      collision = false;
      wsPort  = rpcPort + 1;
      p2pPort = rpcPort + 3;
    } else {
      rpcPort += PORT_STEP;
      if (rpcPort > PORT_END) throw new Error('Port pool exhausted.');
    }
  }

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
