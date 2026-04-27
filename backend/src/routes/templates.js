const express = require('express');

const router = express.Router();

// Template definitions for all supported blockchain types
const templates = {
  evm: [
    {
      id: 'evm-ethereum-pos',
      name: 'Ethereum PoS Clone',
      description: 'Full Ethereum proof-of-stake chain with EVM compatibility, EIP-1559, and beacon chain.',
      type: 'evm',
      category: 'Layer 1',
      difficulty: 'beginner',
      estimatedSetupTime: '5 min',
      features: ['EVM Compatible', 'Smart Contracts', 'EIP-1559', 'Proof of Stake'],
      icon: '⟠',
      defaults: {
        consensus: 'pos',
        blockTime: 12,
        blockGasLimit: '30000000',
        symbol: 'ETH',
      },
    },
    {
      id: 'evm-ethereum-poa',
      name: 'Ethereum PoA (Clique)',
      description: 'Authority-based Ethereum chain perfect for private/consortium networks.',
      type: 'evm',
      category: 'Layer 1',
      difficulty: 'beginner',
      estimatedSetupTime: '3 min',
      features: ['EVM Compatible', 'Low Latency', 'Authority Nodes', 'Private Network'],
      icon: '🔐',
      defaults: {
        consensus: 'poa',
        blockTime: 5,
        blockGasLimit: '30000000',
        symbol: 'ETH',
      },
    },
    {
      id: 'evm-bsc-clone',
      name: 'BNB Smart Chain Clone',
      description: 'High-throughput DPoS chain compatible with BSC ecosystem.',
      type: 'evm',
      category: 'Layer 1',
      difficulty: 'intermediate',
      estimatedSetupTime: '8 min',
      features: ['EVM Compatible', 'DPoS Consensus', 'Fast Blocks', 'Low Fees'],
      icon: '💛',
      defaults: {
        consensus: 'dpos',
        blockTime: 3,
        blockGasLimit: '140000000',
        symbol: 'BNB',
      },
    },
    {
      id: 'evm-polygon-clone',
      name: 'Polygon PoS Clone',
      description: 'Scalable sidechain with checkpoints to Ethereum.',
      type: 'evm',
      category: 'Layer 2',
      difficulty: 'intermediate',
      estimatedSetupTime: '10 min',
      features: ['EVM Compatible', 'PoS + Plasma', 'Checkpointing', 'High TPS'],
      icon: '💜',
      defaults: {
        consensus: 'pos',
        blockTime: 2,
        blockGasLimit: '20000000',
        symbol: 'MATIC',
      },
    },
    {
      id: 'evm-avalanche-subnet',
      name: 'Avalanche Subnet',
      description: 'Custom subnet with Snowman consensus protocol.',
      type: 'evm',
      category: 'Layer 1',
      difficulty: 'advanced',
      estimatedSetupTime: '15 min',
      features: ['Snowman Consensus', 'Custom VM', 'Sub-second Finality', 'Horizontal Scaling'],
      icon: '🔺',
      defaults: {
        consensus: 'snowman',
        blockTime: 2,
        blockGasLimit: '15000000',
        symbol: 'AVAX',
      },
    },
    {
      id: 'evm-optimistic-rollup',
      name: 'Optimistic Rollup (L2)',
      description: 'Layer 2 rollup with fraud proofs, settling on Ethereum.',
      type: 'evm',
      category: 'Layer 2',
      difficulty: 'advanced',
      estimatedSetupTime: '20 min',
      features: ['L2 Scaling', 'Fraud Proofs', 'EVM Equivalent', 'Batch Compression'],
      icon: '🔴',
      defaults: {
        consensus: 'sequencer',
        blockTime: 2,
        blockGasLimit: '30000000',
        symbol: 'ETH',
      },
    },
    {
      id: 'evm-zk-rollup',
      name: 'ZK-Rollup (L2)',
      description: 'Layer 2 with zero-knowledge validity proofs for instant finality.',
      type: 'evm',
      category: 'Layer 2',
      difficulty: 'expert',
      estimatedSetupTime: '30 min',
      features: ['ZK Proofs', 'Instant Finality', 'Privacy Options', 'Data Compression'],
      icon: '🟣',
      defaults: {
        consensus: 'zk-sequencer',
        blockTime: 1,
        blockGasLimit: '30000000',
        symbol: 'ETH',
      },
    },
  ],
  substrate: [
    {
      id: 'substrate-standalone',
      name: 'Standalone Substrate Chain',
      description: 'Independent Substrate chain with customizable runtime.',
      type: 'substrate',
      category: 'Layer 1',
      difficulty: 'intermediate',
      estimatedSetupTime: '15 min',
      features: ['Forkless Upgrades', 'Custom Pallets', 'WASM Runtime', 'On-chain Governance'],
      icon: '⚪',
      defaults: {
        consensus: 'aura+grandpa',
        blockTime: 6,
        symbol: 'DOT',
      },
    },
    {
      id: 'substrate-parachain',
      name: 'Polkadot Parachain',
      description: 'Parachain connected to Polkadot relay chain for shared security.',
      type: 'substrate',
      category: 'Layer 1',
      difficulty: 'advanced',
      estimatedSetupTime: '25 min',
      features: ['Shared Security', 'Cross-chain Messages', 'Slot Auctions', 'XCMP'],
      icon: '🟡',
      defaults: {
        consensus: 'relay-validated',
        blockTime: 12,
        symbol: 'DOT',
      },
    },
    {
      id: 'substrate-smart-contract',
      name: 'Substrate Smart Contract Chain',
      description: 'Substrate chain with ink! smart contract support and EVM compatibility.',
      type: 'substrate',
      category: 'Layer 1',
      difficulty: 'intermediate',
      estimatedSetupTime: '15 min',
      features: ['ink! Contracts', 'EVM Pallet', 'WASM + EVM', 'Forkless Upgrades'],
      icon: '📝',
      defaults: {
        consensus: 'aura+grandpa',
        blockTime: 6,
        symbol: 'TOKEN',
      },
    },
  ],
  cosmos: [
    {
      id: 'cosmos-standard',
      name: 'Cosmos SDK Chain',
      description: 'Standard Cosmos chain with Tendermint BFT consensus.',
      type: 'cosmos',
      category: 'Layer 1',
      difficulty: 'intermediate',
      estimatedSetupTime: '12 min',
      features: ['Tendermint BFT', 'IBC Ready', 'Cosmos SDK Modules', 'Instant Finality'],
      icon: '⚛️',
      defaults: {
        consensus: 'tendermint',
        blockTime: 5,
        symbol: 'ATOM',
      },
    },
    {
      id: 'cosmos-ibc',
      name: 'IBC-Enabled Chain',
      description: 'Cosmos chain with Inter-Blockchain Communication for cross-chain transfers.',
      type: 'cosmos',
      category: 'Layer 1',
      difficulty: 'advanced',
      estimatedSetupTime: '20 min',
      features: ['IBC Protocol', 'Cross-chain Transfers', 'Relayer Support', 'Multi-chain'],
      icon: '🌐',
      defaults: {
        consensus: 'tendermint',
        blockTime: 5,
        symbol: 'TOKEN',
      },
    },
    {
      id: 'cosmos-defi',
      name: 'DeFi Application Chain',
      description: 'Purpose-built chain for DeFi applications with CosmWasm smart contracts.',
      type: 'cosmos',
      category: 'Application',
      difficulty: 'advanced',
      estimatedSetupTime: '20 min',
      features: ['CosmWasm', 'DEX Module', 'Lending Module', 'Oracle Support'],
      icon: '💰',
      defaults: {
        consensus: 'tendermint',
        blockTime: 3,
        symbol: 'DEFI',
      },
    },
  ],
  hyperledger: [
    {
      id: 'hyperledger-fabric',
      name: 'Hyperledger Fabric',
      description: 'Enterprise-grade permissioned blockchain with channels and chaincode.',
      type: 'hyperledger',
      category: 'Enterprise',
      difficulty: 'advanced',
      estimatedSetupTime: '25 min',
      features: ['Permissioned', 'Channels', 'Chaincode', 'Enterprise Ready'],
      icon: '🏢',
      defaults: {
        consensus: 'raft',
        blockTime: 2,
        symbol: 'N/A',
      },
    },
    {
      id: 'hyperledger-besu',
      name: 'Hyperledger Besu',
      description: 'Enterprise Ethereum client supporting both public and private networks.',
      type: 'hyperledger',
      category: 'Enterprise',
      difficulty: 'intermediate',
      estimatedSetupTime: '15 min',
      features: ['EVM Compatible', 'Privacy Groups', 'Permissioning', 'IBFT 2.0'],
      icon: '🐝',
      defaults: {
        consensus: 'ibft2',
        blockTime: 4,
        symbol: 'ETH',
      },
    },
  ],
  solana: [
    {
      id: 'solana-fork',
      name: 'Solana Fork',
      description: 'High-performance chain with Proof of History consensus.',
      type: 'solana',
      category: 'Layer 1',
      difficulty: 'expert',
      estimatedSetupTime: '30 min',
      features: ['Proof of History', '65k TPS', 'Parallel Processing', 'Turbine Protocol'],
      icon: '🟢',
      defaults: {
        consensus: 'poh+pos',
        blockTime: 0.4,
        symbol: 'SOL',
      },
    },
  ],
  dag: [
    {
      id: 'dag-iota-style',
      name: 'DAG-Based (IOTA Style)',
      description: 'Directed Acyclic Graph ledger with feeless transactions.',
      type: 'dag',
      category: 'Layer 1',
      difficulty: 'expert',
      estimatedSetupTime: '30 min',
      features: ['Feeless Transactions', 'DAG Structure', 'IoT Optimized', 'Parallel Processing'],
      icon: '🕸️',
      defaults: {
        consensus: 'tip-selection',
        blockTime: 0,
        symbol: 'IOTA',
      },
    },
  ],
  custom: [
    {
      id: 'custom-blank',
      name: 'Custom Blockchain',
      description: 'Start from scratch - choose every parameter of your blockchain.',
      type: 'custom',
      category: 'Custom',
      difficulty: 'expert',
      estimatedSetupTime: 'varies',
      features: ['Full Customization', 'Any Consensus', 'Custom VM', 'Your Rules'],
      icon: '🔧',
      defaults: {
        consensus: 'custom',
        blockTime: 5,
        symbol: 'TOKEN',
      },
    },
  ],
};

// GET /api/templates - List all templates
router.get('/', (req, res) => {
  const { type, category, difficulty } = req.query;
  
  let result = {};
  
  if (type) {
    result[type] = templates[type] || [];
  } else {
    result = { ...templates };
  }

  // Apply filters
  if (category || difficulty) {
    for (const key of Object.keys(result)) {
      result[key] = result[key].filter(t => {
        if (category && t.category.toLowerCase() !== category.toLowerCase()) return false;
        if (difficulty && t.difficulty !== difficulty) return false;
        return true;
      });
    }
  }

  const totalCount = Object.values(result).reduce((sum, arr) => sum + arr.length, 0);

  res.json({
    success: true,
    data: {
      templates: result,
      total: totalCount,
      types: Object.keys(templates),
    },
  });
});

// GET /api/templates/:id - Get specific template
router.get('/:id', (req, res) => {
  for (const category of Object.values(templates)) {
    const template = category.find(t => t.id === req.params.id);
    if (template) {
      return res.json({ success: true, data: { template } });
    }
  }
  res.status(404).json({ success: false, error: 'Template not found.' });
});

module.exports = router;
