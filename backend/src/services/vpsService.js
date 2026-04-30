/**
 * ChainForge — Hetzner VPS Service
 *
 * Manages SSH connections to Hetzner VPS and executes
 * Docker commands to deploy real blockchain nodes.
 *
 * Architecture:
 *   Railway Backend → SSH → Hetzner VPS → Docker containers
 */

const { NodeSSH } = require('node-ssh');
const { getTemplate } = require('./blockchainTemplates');
const { allocatePorts, freePorts } = require('./portManager');


// ── SSH connection pool ──────────────────────────────────
// Reuse connections instead of reconnecting every time
const connectionPool = new Map();

/**
 * Get or create an SSH connection to a VPS
 */
async function getSSHConnection(vpsConfig) {
  const key = vpsConfig.host;

  if (connectionPool.has(key)) {
    const existing = connectionPool.get(key);
    // Check if still alive
    try {
      await existing.execCommand('echo ping', { timeout: 3000 });
      return existing;
    } catch {
      connectionPool.delete(key);
    }
  }

  const ssh = new NodeSSH();
  await ssh.connect({
    host: vpsConfig.host,
    port: vpsConfig.port || 22,
    username: vpsConfig.username || 'root',
    // Use private key (stored as Railway env var)
    privateKey: vpsConfig.privateKey,
    // Or password (less secure)
    password: vpsConfig.password,
    readyTimeout: 15000,
    keepaliveInterval: 30000,
  });

  connectionPool.set(key, ssh);
  return ssh;
}

/**
 * Run a command on the VPS and return output
 */
async function runOnVPS(ssh, command, options = {}) {
  const result = await ssh.execCommand(command, {
    onStdout: options.onOutput,
    onStderr: options.onError || options.onOutput,
    ...options,
  });

  if (result.code !== 0 && !options.allowFail) {
    throw new Error(`VPS command failed: ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}

/**
 * Get VPS config from environment variables
 */
function getVPSConfig() {
  const host = process.env.VPS_HOST;
  if (!host) return null;

  return {
    host,
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER || 'root',
    privateKey: process.env.VPS_SSH_KEY
      ? process.env.VPS_SSH_KEY.replace(/\\n/g, '\n').trim() + '\n'
      : undefined,
    password: process.env.VPS_PASSWORD,
  };
}

/**
 * Check if VPS is configured and reachable
 */
async function isVPSAvailable() {
  const config = getVPSConfig();
  if (!config) {
    console.log('🖥️  VPS: no config (VPS_HOST not set)');
    return false;
  }
  console.log(`🖥️  VPS: trying SSH to ${config.host}:${config.port} as ${config.username}`);
  console.log(`🖥️  VPS: auth method = ${config.privateKey ? 'SSH_KEY' : config.password ? 'PASSWORD' : 'NONE'}`);
  try {
    const ssh = await getSSHConnection(config);
    await ssh.execCommand('echo ping');
    console.log(`✅ VPS: ${config.host} is reachable.`);
    return true;
  } catch (err) {
    console.error(`❌ VPS: ${config.host} connection failed:`, err.message);
    return false;
  }
}

/**
 * One-time VPS setup — run this ONCE when you first configure the VPS
 * Sets up Docker, creates network, data directory
 */
async function setupVPS(ssh) {
  const setupCommands = [
    // Create data directory for all chains
    'mkdir -p /data/chainforge',
    // Create isolated Docker network for all ChainForge containers
    'docker network create chainforge-net 2>/dev/null || true',
    // Set proper permissions
    'chmod 755 /data/chainforge',
  ];

  for (const cmd of setupCommands) {
    await runOnVPS(ssh, cmd, { allowFail: true });
  }
}

/**
 * Deploy a blockchain node on the VPS
 *
 * @param {object} chain       - Mongoose Chain document
 * @param {string} network     - 'testnet' | 'mainnet'
 * @param {function} onLog     - Progress callback
 * @returns {object}           - { containerId, containerName, rpcPort, wsPort, p2pPort }
 */
async function deployOnVPS(chain, network, onLog) {
  const vpsConfig = getVPSConfig();
  if (!vpsConfig) throw new Error('VPS not configured.');

  const chainIdStr = chain._id.toString().slice(-8);
  const containerName = `cf-${network}-${chainIdStr}`;
  const template = getTemplate(chain.type);
  const { rpcPort, wsPort, p2pPort } = await allocatePorts(
    chain._id,
    chain.type,
    network,
    containerName
  );


  let ssh;
  try {
    await onLog('🔌 Connecting to deployment server...');
    ssh = await getSSHConnection(vpsConfig);

    // First-time setup (idempotent)
    await onLog('🛠️  Preparing server environment...');
    await setupVPS(ssh);

    // Pull Docker image
    await onLog(`📥 Pulling ${chain.type.toUpperCase()} Docker image...`);
    await runOnVPS(ssh, `docker pull ${template.image}`, {
      onOutput: (chunk) => {/* suppress verbose pull output */},
      allowFail: false,
    });
    await onLog(`✅ Image ready: ${template.image}`);

    // Remove existing container with same name if any
    await runOnVPS(ssh, `docker rm -f ${containerName} 2>/dev/null || true`, { allowFail: true });

    // Build Docker command
    const dockerCmd = template.getDockerCmd({
      containerName,
      chainId: chain.config?.chainId,
      blockTime: chain.config?.blockTime,
      consensus: chain.config?.consensus,
      rpcPort,
      wsPort,
      p2pPort,
      memory: getMemoryLimit(chain.type),
      cpus: getCpuLimit(chain.type),
    });

    // Launch container
    await onLog(`🐳 Creating ${chain.type.toUpperCase()} container...`);
    const containerId = await runOnVPS(ssh, dockerCmd);
    await onLog(`✅ Container started: ${containerId.slice(0, 12)}`);

    // Wait for node to be ready
    await onLog('⏳ Waiting for node to initialize...');
    await waitForNode(ssh, template.healthCheck(rpcPort), onLog);

    await onLog('✅ Blockchain node is live!');

    return {
      containerId,
      containerName,
      rpcPort,
      wsPort,
      p2pPort,
      vpsHost: vpsConfig.host,
    };
  } catch (err) {
    // Free the ports on failure
    freePorts(rpcPort, wsPort, p2pPort);
    throw err;
  }
}

/**
 * Stop and remove a container from the VPS
 */
async function stopOnVPS(chainId, containerName) {
  const vpsConfig = getVPSConfig();
  if (!vpsConfig) return;

  try {
    const ssh = await getSSHConnection(vpsConfig);
    
    // If container name isn't provided, we try to reconstruct it for both testnet and mainnet
    const idStr = chainId.toString().slice(-8);
    const names = containerName ? [containerName] : [`cf-testnet-${idStr}`, `cf-mainnet-${idStr}`];

    for (const name of names) {
      console.log(`🛑 Stopping and removing ${name}...`);
      await runOnVPS(ssh, `docker stop ${name} && docker rm ${name}`, { allowFail: true });
      // Clean up data volume to free disk space
      await runOnVPS(ssh, `rm -rf /data/chainforge/${name}`, { allowFail: true });
    }
    
    // Prune unused docker resources to reclaim space
    console.log(`🧹 Pruning unused Docker images and volumes...`);
    await runOnVPS(ssh, `docker image prune -a -f --filter "until=24h" && docker volume prune -f`, { allowFail: true });
    
    console.log(`✅ VPS resources cleaned up for chain: ${chainId}`);
  } catch (err) {
    console.warn('Stop VPS container error:', err.message);
  }
}

/**
 * Get logs from a running container
 */
async function getContainerLogs(containerName, lines = 50) {
  const vpsConfig = getVPSConfig();
  if (!vpsConfig) return '';

  try {
    const ssh = await getSSHConnection(vpsConfig);
    return await runOnVPS(ssh, `docker logs --tail ${lines} ${containerName}`, { allowFail: true });
  } catch {
    return '';
  }
}

/**
 * Get container status
 */
async function getContainerStatus(containerName) {
  const vpsConfig = getVPSConfig();
  if (!vpsConfig) return 'unknown';

  try {
    const ssh = await getSSHConnection(vpsConfig);
    const status = await runOnVPS(ssh, `docker inspect --format='{{.State.Status}}' ${containerName}`, { allowFail: true });
    return status || 'stopped';
  } catch {
    return 'unknown';
  }
}

/**
 * Wait for a blockchain node to be ready (health check)
 */
async function waitForNode(ssh, healthCmd, onLog, maxRetries = 20, delayMs = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, delayMs));
    const result = await runOnVPS(ssh, healthCmd, { allowFail: true });
    if (result && !result.includes('error')) {
      return true;
    }
    if (i % 4 === 0) await onLog(`⏳ Node starting... (${(i + 1) * delayMs / 1000}s)`);
  }
  // Don't fail — node might just be slow
  await onLog('⚠️  Node may still be initializing. Check logs if needed.');
  return false;
}

/**
 * Resource limits per chain type
 */
function getMemoryLimit(chainType) {
  const limits = {
    evm: '512m',
    hyperledger: '512m',
    substrate: '1g',
    cosmos: '1g',
    solana: '2g',
    dag: '1g',
    custom: '512m',
  };
  return limits[chainType] || '512m';
}

function getCpuLimit(chainType) {
  const limits = {
    evm: '0.5',
    hyperledger: '0.5',
    substrate: '1.0',
    cosmos: '1.0',
    solana: '2.0',
    dag: '1.0',
    custom: '0.5',
  };
  return limits[chainType] || '0.5';
}

module.exports = {
  deployOnVPS,
  stopOnVPS,
  getContainerLogs,
  getContainerStatus,
  isVPSAvailable,
  getSSHConnection,
  runOnVPS,
  getVPSConfig,
};
