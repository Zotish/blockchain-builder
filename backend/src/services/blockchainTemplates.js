/**
 * ChainForge — Blockchain Node Templates
 *
 * Docker commands + configs for every supported blockchain type.
 * These are executed on the Hetzner VPS via SSH.
 */

/**
 * All supported chain types and their Docker setup
 */
const CHAIN_TEMPLATES = {

  // ─────────────────────────────────────────────────
  // EVM — Geth (Go-Ethereum)
  // Supports: PoA (Clique), PoW, PoS-like with --dev
  // ─────────────────────────────────────────────────
  evm: {
    image: 'ethereum/client-go:stable',
    getDockerCmd: (cfg) => `
docker run -d \\
  --name ${cfg.containerName} \\
  --restart unless-stopped \\
  --memory="${cfg.memory || '512m'}" \\
  --cpus="${cfg.cpus || '0.5'}" \\
  -p ${cfg.rpcPort}:8545 \\
  -p ${cfg.wsPort}:8546 \\
  -p ${cfg.p2pPort}:30303 \\
  -v /data/chainforge/${cfg.containerName}:/chaindata \\
  --network chainforge-net \\
  ethereum/client-go:stable \\
  --dev \\
  --dev.period ${cfg.blockTime || 5} \\
  --datadir /chaindata \\
  --http \\
  --http.addr 0.0.0.0 \\
  --http.port 8545 \\
  --http.corsdomain "*" \\
  --http.api eth,net,web3,personal,admin,debug,txpool \\
  --ws \\
  --ws.addr 0.0.0.0 \\
  --ws.port 8546 \\
  --ws.origins "*" \\
  --ws.api eth,net,web3,personal \\
  --networkid ${cfg.chainId} \\
  --verbosity 3 \\
  --allow-insecure-unlock \\
  --nodiscover
`.trim(),
    healthCheck: (rpcPort) => `curl -sf http://localhost:${rpcPort} -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`,
    defaultPorts: { rpcPort: 8545, wsPort: 8546, p2pPort: 30303 },
  },

  // ─────────────────────────────────────────────────
  // EVM — Hyperledger Besu (Enterprise EVM)
  // ─────────────────────────────────────────────────
  hyperledger: {
    image: 'hyperledger/besu:latest',
    getDockerCmd: (cfg) => `
docker run -d \\
  --name ${cfg.containerName} \\
  --restart unless-stopped \\
  --memory="${cfg.memory || '512m'}" \\
  --cpus="${cfg.cpus || '0.5'}" \\
  -p ${cfg.rpcPort}:8545 \\
  -p ${cfg.wsPort}:8546 \\
  -p ${cfg.p2pPort}:30303 \\
  -v /data/chainforge/${cfg.containerName}:/opt/besu/data \\
  --network chainforge-net \\
  hyperledger/besu:latest \\
  --network=dev \\
  --data-path=/opt/besu/data \\
  --rpc-http-enabled \\
  --rpc-http-host=0.0.0.0 \\
  --rpc-http-port=8545 \\
  --rpc-http-cors-origins=* \\
  --rpc-http-api=ETH,NET,WEB3,ADMIN,DEBUG \\
  --rpc-ws-enabled \\
  --rpc-ws-host=0.0.0.0 \\
  --rpc-ws-port=8546 \\
  --host-allowlist=* \\
  --network-id=${cfg.chainId} \\
  --logging=INFO
`.trim(),
    healthCheck: (rpcPort) => `curl -sf http://localhost:${rpcPort} -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`,
    defaultPorts: { rpcPort: 8545, wsPort: 8546, p2pPort: 30303 },
  },

  // ─────────────────────────────────────────────────
  // Substrate — Polkadot SDK
  // ─────────────────────────────────────────────────
  substrate: {
    image: 'paritytech/substrate-node:latest',
    getDockerCmd: (cfg) => `
docker run -d \\
  --name ${cfg.containerName} \\
  --restart unless-stopped \\
  --memory="${cfg.memory || '1g'}" \\
  --cpus="${cfg.cpus || '1.0'}" \\
  -p ${cfg.rpcPort}:9944 \\
  -p ${cfg.p2pPort}:30333 \\
  -v /data/chainforge/${cfg.containerName}:/data \\
  --network chainforge-net \\
  paritytech/substrate-node:latest \\
  --dev \\
  --base-path /data \\
  --rpc-external \\
  --rpc-cors all \\
  --rpc-port 9944 \\
  --port 30333 \\
  --rpc-methods Unsafe \\
  --name ${cfg.chainId}-node
`.trim(),
    healthCheck: (rpcPort) => `curl -sf http://localhost:${rpcPort}/health`,
    defaultPorts: { rpcPort: 9944, wsPort: 9944, p2pPort: 30333 },
  },

  // ─────────────────────────────────────────────────
  // Cosmos SDK — via Ignite CLI / gaiad
  // ─────────────────────────────────────────────────
  cosmos: {
    image: 'ghcr.io/cosmos/gaia:latest',
    getDockerCmd: (cfg) => `
docker run -d \\
  --name ${cfg.containerName} \\
  --restart unless-stopped \\
  --memory="${cfg.memory || '1g'}" \\
  --cpus="${cfg.cpus || '1.0'}" \\
  -p ${cfg.rpcPort}:26657 \\
  -p ${cfg.rpcPort + 1}:1317 \\
  -p ${cfg.p2pPort}:26656 \\
  -v /data/chainforge/${cfg.containerName}:/root/.gaia \\
  --network chainforge-net \\
  ghcr.io/cosmos/gaia:latest \\
  sh -c "
    gaiad init ${cfg.containerName} --chain-id ${cfg.chainId}-1 &&
    gaiad keys add validator --keyring-backend test &&
    gaiad genesis add-genesis-account validator 1000000000stake --keyring-backend test &&
    gaiad genesis gentx validator 100000000stake --chain-id ${cfg.chainId}-1 --keyring-backend test &&
    gaiad genesis collect-gentxs &&
    sed -i 's/127.0.0.1:26657/0.0.0.0:26657/g' /root/.gaia/config/config.toml &&
    sed -i 's/cors_allowed_origins = \\[\\]/cors_allowed_origins = [\\\"*\\\"]/g' /root/.gaia/config/config.toml &&
    gaiad start
  "
`.trim(),
    healthCheck: (rpcPort) => `curl -sf http://localhost:${rpcPort}/status`,
    defaultPorts: { rpcPort: 26657, wsPort: 26657, p2pPort: 26656 },
  },

  // ─────────────────────────────────────────────────
  // Solana — Test Validator
  // ─────────────────────────────────────────────────
  solana: {
    image: 'solanalabs/solana:stable',
    getDockerCmd: (cfg) => `
docker run -d \\
  --name ${cfg.containerName} \\
  --restart unless-stopped \\
  --memory="${cfg.memory || '2g'}" \\
  --cpus="${cfg.cpus || '2.0'}" \\
  -p ${cfg.rpcPort}:8899 \\
  -p ${cfg.wsPort}:8900 \\
  -v /data/chainforge/${cfg.containerName}:/ledger \\
  --network chainforge-net \\
  solanalabs/solana:stable \\
  solana-test-validator \\
  --ledger /ledger \\
  --rpc-port 8899 \\
  --bind-address 0.0.0.0 \\
  --no-bpf-jit \\
  --log -
`.trim(),
    healthCheck: (rpcPort) => `curl -sf http://localhost:${rpcPort}/health`,
    defaultPorts: { rpcPort: 8899, wsPort: 8900, p2pPort: 8001 },
  },

  // ─────────────────────────────────────────────────
  // DAG — IOTA Hornet node
  // ─────────────────────────────────────────────────
  dag: {
    image: 'iotaledger/hornet:latest',
    getDockerCmd: (cfg) => `
docker run -d \\
  --name ${cfg.containerName} \\
  --restart unless-stopped \\
  --memory="${cfg.memory || '1g'}" \\
  --cpus="${cfg.cpus || '1.0'}" \\
  -p ${cfg.rpcPort}:14265 \\
  -p ${cfg.p2pPort}:15600 \\
  -v /data/chainforge/${cfg.containerName}:/app/data \\
  --network chainforge-net \\
  iotaledger/hornet:latest \\
  --node.alias="${cfg.containerName}" \\
  --restAPI.bindAddress=0.0.0.0:14265 \\
  --p2p.bindAddress=0.0.0.0:15600
`.trim(),
    healthCheck: (rpcPort) => `curl -sf http://localhost:${rpcPort}/health`,
    defaultPorts: { rpcPort: 14265, wsPort: 14265, p2pPort: 15600 },
  },

  // ─────────────────────────────────────────────────
  // Custom — User brings their own Docker image/config
  // Falls back to Geth if no custom config given
  // ─────────────────────────────────────────────────
  custom: {
    image: 'ethereum/client-go:stable', // default fallback
    getDockerCmd: (cfg) => {
      // If user provided a custom Docker image, use that
      const image = cfg.customImage || cfg.customConfig?.dockerImage || 'ethereum/client-go:stable';
      const customCmd = cfg.customConfig?.dockerCommand;
      const baseType = cfg.customConfig?.baseType; // 'evm' | 'substrate' | 'cosmos' | 'solana'

      // ── Option 1: Full custom Docker command from user ──
      if (customCmd) {
        return customCmd
          .replace(/\{\{containerName\}\}/g, cfg.containerName)
          .replace(/\{\{rpcPort\}\}/g, cfg.rpcPort)
          .replace(/\{\{wsPort\}\}/g, cfg.wsPort)
          .replace(/\{\{p2pPort\}\}/g, cfg.p2pPort)
          .replace(/\{\{chainId\}\}/g, cfg.chainId)
          .replace(/\{\{blockTime\}\}/g, cfg.blockTime || 5)
          .replace(/\{\{dataDir\}\}/g, `/data/chainforge/${cfg.containerName}`);
      }

      // ── Option 2: Base type + custom image ──
      if (baseType && CHAIN_TEMPLATES[baseType]) {
        const baseCfg = { ...cfg };
        const baseCmd = CHAIN_TEMPLATES[baseType].getDockerCmd(baseCfg);
        // Replace the base image with user's custom image
        if (cfg.customImage) {
          const baseImage = CHAIN_TEMPLATES[baseType].image;
          return baseCmd.replace(new RegExp(baseImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), image);
        }
        return baseCmd;
      }

      // ── Option 3: Custom Docker image with minimal config ──
      if (cfg.customImage && cfg.customImage !== 'ethereum/client-go:stable') {
        return `
docker run -d \\
  --name ${cfg.containerName} \\
  --restart unless-stopped \\
  --memory="${cfg.memory || '1g'}" \\
  --cpus="${cfg.cpus || '1.0'}" \\
  -p ${cfg.rpcPort}:${cfg.customConfig?.internalRpcPort || 8545} \\
  -p ${cfg.wsPort}:${cfg.customConfig?.internalWsPort || 8546} \\
  -p ${cfg.p2pPort}:${cfg.customConfig?.internalP2pPort || 30303} \\
  -v /data/chainforge/${cfg.containerName}:/data \\
  --network chainforge-net \\
  ${image} \\
  ${cfg.customConfig?.startCommand || ''}
`.trim();
      }

      // ── Fallback: standard EVM ──
      return CHAIN_TEMPLATES.evm.getDockerCmd(cfg);
    },
    healthCheck: (rpcPort) => `curl -sf http://localhost:${rpcPort} -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' || curl -sf http://localhost:${rpcPort}/health || curl -sf http://localhost:${rpcPort}/api/v2/info`,
    defaultPorts: { rpcPort: 8545, wsPort: 8546, p2pPort: 30303 },
  },
};

/**
 * Port pool manager — tracks used ports to avoid conflicts
 * In production this should be stored in MongoDB
 */
const usedPorts = new Set();
let portCounter = 9000;

function allocatePorts(chainType) {
  const template = CHAIN_TEMPLATES[chainType] || CHAIN_TEMPLATES.evm;
  const base = template.defaultPorts;

  // Find free port block (increment by 10 each time)
  while (
    usedPorts.has(portCounter) ||
    usedPorts.has(portCounter + 1) ||
    usedPorts.has(portCounter + 3)
  ) {
    portCounter += 10;
  }

  const rpcPort = portCounter;
  const wsPort = portCounter + 1;
  const p2pPort = portCounter + 3;

  usedPorts.add(rpcPort);
  usedPorts.add(wsPort);
  usedPorts.add(p2pPort);
  portCounter += 10;

  return { rpcPort, wsPort, p2pPort };
}

function freePorts(rpcPort, wsPort, p2pPort) {
  usedPorts.delete(rpcPort);
  usedPorts.delete(wsPort);
  usedPorts.delete(p2pPort);
}

function getTemplate(chainType) {
  return CHAIN_TEMPLATES[chainType] || CHAIN_TEMPLATES.evm;
}

module.exports = { CHAIN_TEMPLATES, getTemplate, allocatePorts, freePorts };
