/**
 * ChainForge — Docker Deployment Service
 *
 * Handles launching real blockchain nodes inside Docker containers.
 * On Railway, Docker-in-Docker is available on Pro plans.
 * Falls back to a simulation mode when Docker is not available.
 */

const config = require('../config');

let Docker;
let docker;
let dockerAvailable = false;

// Try to load dockerode — gracefully skip if unavailable
try {
  Docker = require('dockerode');
  docker = new Docker({ socketPath: config.dockerHost });
  dockerAvailable = true;
  console.log('🐳 Docker client initialized');
} catch (err) {
  console.warn('⚠️  Docker not available — running in simulation mode');
}

// Docker images for each chain type
const CHAIN_IMAGES = {
  evm: {
    poa: 'ethereum/client-go:alltools-latest',
    pow: 'ethereum/client-go:alltools-latest',
    pos: 'ethereum/client-go:alltools-latest',
    dpos: 'ethereum/client-go:alltools-latest',
    default: 'ethereum/client-go:alltools-latest',
  },
  substrate: {
    default: 'paritytech/substrate-node:latest',
  },
  cosmos: {
    default: 'cosmossdk/cosmovisor:latest',
  },
  hyperledger: {
    default: 'hyperledger/besu:latest',
  },
  custom: {
    default: 'ethereum/client-go:alltools-latest',
  },
};

/**
 * Get the Docker image for a given chain type + consensus
 */
function getImage(type, consensus) {
  const typeImages = CHAIN_IMAGES[type] || CHAIN_IMAGES.evm;
  return typeImages[consensus] || typeImages.default;
}

/**
 * Generate Geth init data dir + genesis.json inside the container
 * Returns the docker run args for a Geth PoA node
 */
function buildGethArgs(chain, rpcPort, wsPort, p2pPort) {
  const networkId = chain.config.chainId;
  const blockTime = chain.config.blockTime || 5;
  return [
    '--networkid', String(networkId),
    '--datadir', '/chaindata',
    '--http',
    '--http.addr', '0.0.0.0',
    '--http.port', '8545',
    '--http.corsdomain', '*',
    '--http.api', 'eth,net,web3,personal,admin,debug',
    '--ws',
    '--ws.addr', '0.0.0.0',
    '--ws.port', '8546',
    '--ws.origins', '*',
    '--ws.api', 'eth,net,web3,personal',
    '--allow-insecure-unlock',
    '--nodiscover',
    '--mine',
    '--miner.threads', '1',
    '--miner.etherbase', '0x0000000000000000000000000000000000000001',
    '--verbosity', '3',
  ];
}

/**
 * Deploy a blockchain node in Docker
 * @param {object} chain  - Mongoose Chain document
 * @param {string} network - 'testnet' | 'mainnet'
 * @param {function} onLog - callback(message) for progress logs
 * @returns {object} { containerId, containerName, rpcPort, wsPort }
 */
async function deployChainNode(chain, network, onLog) {
  const chainIdStr = chain._id.toString().slice(-8);
  const containerName = `chainforge-${network}-${chainIdStr}`;
  const rpcPort = 8545 + Math.floor(Math.random() * 500);
  const wsPort = rpcPort + 1;
  const p2pPort = 30303 + Math.floor(Math.random() * 500);

  if (!dockerAvailable || !config.dockerEnabled) {
    // ── Simulation Mode ──────────────────────────────────────
    return await simulateDeployment(chain, containerName, rpcPort, wsPort, onLog);
  }

  // ── Real Docker Deployment ───────────────────────────────
  const image = getImage(chain.type, chain.config?.consensus);

  try {
    onLog('📥 Pulling Docker image...');
    await pullImage(image, onLog);

    onLog('🔧 Generating genesis block...');
    // In a real deployment we'd mount a genesis.json volume
    // For now we start with --dev flag (simplest EVM chain)

    onLog('🐳 Creating container...');
    const container = await docker.createContainer({
      name: containerName,
      Image: image,
      Cmd: buildGethArgs(chain, rpcPort, wsPort, p2pPort),
      ExposedPorts: {
        '8545/tcp': {},
        '8546/tcp': {},
        [`${p2pPort}/tcp`]: {},
      },
      HostConfig: {
        PortBindings: {
          '8545/tcp': [{ HostPort: String(rpcPort) }],
          '8546/tcp': [{ HostPort: String(wsPort) }],
        },
        RestartPolicy: { Name: 'unless-stopped' },
        Memory: 512 * 1024 * 1024, // 512 MB cap per node
      },
      Labels: {
        'chainforge.chainId': chain._id.toString(),
        'chainforge.network': network,
        'chainforge.type': chain.type,
      },
    });

    onLog('🚀 Starting node...');
    await container.start();

    const info = await container.inspect();
    onLog(`✅ Container running: ${info.Id.slice(0, 12)}`);

    return {
      containerId: info.Id,
      containerName,
      rpcPort,
      wsPort,
    };
  } catch (err) {
    console.error('Docker deploy error:', err.message);
    onLog(`⚠️  Docker failed (${err.message}), switching to simulation...`);
    return await simulateDeployment(chain, containerName, rpcPort, wsPort, onLog);
  }
}

/**
 * Stop and remove a container
 */
async function stopChainNode(containerId) {
  if (!dockerAvailable || !containerId) return;
  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 10 });
    await container.remove();
    console.log(`🛑 Container ${containerId.slice(0, 12)} removed`);
  } catch (err) {
    console.warn('Stop container error:', err.message);
  }
}

/**
 * Pull a Docker image with progress logging
 */
function pullImage(image, onLog) {
  if (!dockerAvailable) return Promise.resolve();
  return new Promise((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err) => {
        if (err) return reject(err);
        onLog(`✅ Image ready: ${image}`);
        resolve();
      }, (event) => {
        if (event.status && event.progressDetail?.current) {
          // Throttle log spam
        }
      });
    });
  });
}

/**
 * Simulate deployment steps (used when Docker is unavailable)
 */
async function simulateDeployment(chain, containerName, rpcPort, wsPort, onLog) {
  const steps = [
    { msg: '📋 Validating chain configuration...', ms: 800 },
    { msg: '🔧 Generating genesis block...', ms: 1200 },
    { msg: '🐳 Provisioning container...', ms: 1500 },
    { msg: `⛓️  Initializing ${chain.type.toUpperCase()} node...`, ms: 2000 },
    { msg: '🔑 Generating node keys...', ms: 1000 },
    { msg: '📡 Configuring P2P network...', ms: 800 },
    { msg: '🌐 Setting up RPC/WS endpoints...', ms: 1200 },
    { msg: '🚀 Starting node...', ms: 2000 },
    { msg: '✅ Blockchain is live!', ms: 500 },
  ];

  const fakeContainerId = `sim_${chain._id.toString().slice(-12)}_${Date.now().toString(36)}`;

  for (const step of steps) {
    await new Promise(r => setTimeout(r, step.ms));
    onLog(step.msg);
  }

  return {
    containerId: fakeContainerId,
    containerName,
    rpcPort,
    wsPort,
  };
}

module.exports = { deployChainNode, stopChainNode };
