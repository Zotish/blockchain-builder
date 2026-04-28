/**
 * ChainForge — Chain-specific Adapters
 *
 * Each chain type has different:
 * - RPC methods (eth_blockNumber vs system.health vs /status)
 * - Block format
 * - Wallet connection method
 * - Address format
 * - Faucet mechanism
 *
 * This module provides a unified interface.
 */

// ── Chain adapters ───────────────────────────────────────

const adapters = {

  // ═══════════════════════════════════════════════════════
  // EVM (Geth, Besu, etc.)
  // ═══════════════════════════════════════════════════════
  evm: {
    walletName: 'MetaMask',
    walletIcon: '🦊',
    walletUrl: 'https://metamask.io',
    addressFormat: '0x + 40 hex chars',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
    addressPlaceholder: '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD...',

    async getBlocks(rpcUrl, count = 10) {
      const res = await rpcCall(rpcUrl, 'eth_blockNumber', []);
      const latest = parseInt(res, 16);
      const blocks = [];
      for (let i = latest; i > Math.max(latest - count, -1); i--) {
        const b = await rpcCall(rpcUrl, 'eth_getBlockByNumber', ['0x' + i.toString(16), true]);
        if (b) blocks.push({
          number: parseInt(b.number, 16),
          hash: b.hash,
          timestamp: new Date(parseInt(b.timestamp, 16) * 1000),
          txCount: b.transactions?.length || 0,
          gasUsed: parseInt(b.gasUsed, 16),
          miner: b.miner,
          transactions: (b.transactions || []).map(tx => typeof tx === 'string' ? { hash: tx } : {
            hash: tx.hash, from: tx.from, to: tx.to || 'Contract',
            value: (parseInt(tx.value, 16) / 1e18).toFixed(4),
          }),
        });
      }
      return blocks;
    },

    async getStats(rpcUrl) {
      const [blockNum, gasPrice, peerCount] = await Promise.all([
        rpcCall(rpcUrl, 'eth_blockNumber', []).catch(() => '0x0'),
        rpcCall(rpcUrl, 'eth_gasPrice', []).catch(() => '0x3B9ACA00'),
        rpcCall(rpcUrl, 'net_peerCount', []).catch(() => '0x0'),
      ]);
      return {
        blockHeight: parseInt(blockNum, 16),
        gasPrice: parseInt(gasPrice, 16).toString(),
        peers: parseInt(peerCount, 16),
      };
    },

    async faucet(rpcUrl, toAddress, amount) {
      const accounts = await rpcCall(rpcUrl, 'eth_accounts', []);
      if (!accounts?.length) throw new Error('No dev accounts on this chain');
      const amountHex = '0x' + (BigInt(Math.floor(parseFloat(amount) * 1e18))).toString(16);
      const txHash = await rpcCall(rpcUrl, 'eth_sendTransaction', [{
        from: accounts[0], to: toAddress, value: amountHex, gas: '0x5208',
      }]);
      return { txHash, from: accounts[0], to: toAddress, amount };
    },

    connectWalletCode: `// MetaMask
await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: 'CHAIN_ID_HEX', chainName: 'CHAIN_NAME', rpcUrls: ['RPC_URL'] }] });`,
  },

  // ═══════════════════════════════════════════════════════
  // Hyperledger Besu (EVM-compatible)
  // ═══════════════════════════════════════════════════════
  hyperledger: null, // Will use EVM adapter (set below)

  // ═══════════════════════════════════════════════════════
  // Substrate (Polkadot / Kusama)
  // ═══════════════════════════════════════════════════════
  substrate: {
    walletName: 'Polkadot.js',
    walletIcon: '⚪',
    walletUrl: 'https://polkadot.js.org/extension/',
    addressFormat: 'SS58 format (starts with 5, 1, or C...)',
    addressRegex: /^[1-9A-HJ-NP-Za-km-z]{46,48}$/,
    addressPlaceholder: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',

    async getBlocks(rpcUrl, count = 10) {
      // Substrate uses different JSON-RPC methods
      const header = await rpcCall(rpcUrl, 'chain_getHeader', []);
      const latest = parseInt(header?.number, 16) || 0;
      const blocks = [];
      for (let i = latest; i > Math.max(latest - count, -1); i--) {
        const hash = await rpcCall(rpcUrl, 'chain_getBlockHash', [i]);
        const block = await rpcCall(rpcUrl, 'chain_getBlock', [hash]);
        if (block?.block) {
          const b = block.block;
          blocks.push({
            number: i,
            hash: hash,
            timestamp: new Date(), // Substrate stores time in extrinsics
            txCount: b.extrinsics?.length || 0,
            gasUsed: 0,
            miner: b.header?.digest?.logs?.[0] || '—',
            transactions: (b.extrinsics || []).map((ext, idx) => ({
              hash: `${hash}-${idx}`,
              from: '—',
              to: '—',
              value: '—',
            })),
          });
        }
      }
      return blocks;
    },

    async getStats(rpcUrl) {
      const [header, health] = await Promise.all([
        rpcCall(rpcUrl, 'chain_getHeader', []).catch(() => ({ number: '0x0' })),
        rpcCall(rpcUrl, 'system_health', []).catch(() => ({ peers: 0 })),
      ]);
      return {
        blockHeight: parseInt(header?.number, 16) || 0,
        peers: health?.peers || 0,
        gasPrice: '0',
      };
    },

    async faucet(rpcUrl, toAddress, amount) {
      // Substrate faucet requires Keyring — simulated for now
      return {
        txHash: '0x' + randomHex(64),
        from: 'Alice (Dev Account)',
        to: toAddress,
        amount,
        simulated: true,
        note: 'Use Polkadot.js Apps → Accounts → Transfer from Alice to send tokens',
      };
    },

    connectWalletCode: `// Polkadot.js Extension
import { web3Enable, web3Accounts } from '@polkadot/extension-dapp';
const extensions = await web3Enable('ChainForge');
const accounts = await web3Accounts();
// Connect to chain
import { ApiPromise, WsProvider } from '@polkadot/api';
const api = await ApiPromise.create({ provider: new WsProvider('WS_URL') });`,
  },

  // ═══════════════════════════════════════════════════════
  // Cosmos SDK (Tendermint)
  // ═══════════════════════════════════════════════════════
  cosmos: {
    walletName: 'Keplr',
    walletIcon: '⚛',
    walletUrl: 'https://keplr.app',
    addressFormat: 'Bech32 (cosmos1...)',
    addressRegex: /^[a-z]+1[a-z0-9]{38,58}$/,
    addressPlaceholder: 'cosmos1xy4xqhj5rk...z9cqqfh4qw',

    async getBlocks(rpcUrl, count = 10) {
      // Cosmos uses Tendermint REST RPC
      const status = await restCall(`${rpcUrl}/status`);
      const latest = parseInt(status?.result?.sync_info?.latest_block_height || '0');
      const blocks = [];
      for (let i = latest; i > Math.max(latest - count, 0); i--) {
        const res = await restCall(`${rpcUrl}/block?height=${i}`);
        const b = res?.result?.block;
        if (b) blocks.push({
          number: i,
          hash: res.result.block_id?.hash || '—',
          timestamp: new Date(b.header?.time || Date.now()),
          txCount: b.data?.txs?.length || 0,
          gasUsed: 0,
          miner: b.header?.proposer_address || '—',
          transactions: (b.data?.txs || []).map((tx, idx) => ({
            hash: btoa(tx).slice(0, 20) + '...',
            from: '—', to: '—', value: '—',
          })),
        });
      }
      return blocks;
    },

    async getStats(rpcUrl) {
      const status = await restCall(`${rpcUrl}/status`).catch(() => null);
      const netInfo = await restCall(`${rpcUrl}/net_info`).catch(() => null);
      return {
        blockHeight: parseInt(status?.result?.sync_info?.latest_block_height || '0'),
        peers: parseInt(netInfo?.result?.n_peers || '0'),
        gasPrice: '0',
      };
    },

    async faucet(rpcUrl, toAddress, amount) {
      return {
        txHash: '0x' + randomHex(64),
        from: 'validator (Dev Account)',
        to: toAddress,
        amount,
        simulated: true,
        note: `Use CLI: gaiad tx bank send validator ${toAddress} ${amount}stake --keyring-backend test`,
      };
    },

    connectWalletCode: `// Keplr Wallet
await window.keplr.experimentalSuggestChain({
  chainId: 'CHAIN_ID',
  chainName: 'CHAIN_NAME',
  rpc: 'RPC_URL',
  rest: 'REST_URL',
  bip44: { coinType: 118 },
  bech32Config: { bech32PrefixAccAddr: 'cosmos' },
  currencies: [{ coinDenom: 'SYMBOL', coinMinimalDenom: 'uSYMBOL', coinDecimals: 6 }],
  stakeCurrency: { coinDenom: 'SYMBOL', coinMinimalDenom: 'uSYMBOL', coinDecimals: 6 },
});
await window.keplr.enable('CHAIN_ID');`,
  },

  // ═══════════════════════════════════════════════════════
  // Solana
  // ═══════════════════════════════════════════════════════
  solana: {
    walletName: 'Phantom',
    walletIcon: '👻',
    walletUrl: 'https://phantom.app',
    addressFormat: 'Base58 (32-44 chars)',
    addressRegex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    addressPlaceholder: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',

    async getBlocks(rpcUrl, count = 10) {
      const slot = await rpcCall(rpcUrl, 'getSlot', []);
      const blocks = [];
      for (let i = slot; i > Math.max(slot - count, 0); i--) {
        try {
          const block = await rpcCall(rpcUrl, 'getBlock', [i, { encoding: 'json', transactionDetails: 'signatures', maxSupportedTransactionVersion: 0 }]);
          if (block) blocks.push({
            number: i,
            hash: block.blockhash || '—',
            timestamp: new Date((block.blockTime || Math.floor(Date.now() / 1000)) * 1000),
            txCount: block.signatures?.length || 0,
            gasUsed: 0,
            miner: block.rewards?.[0]?.pubkey || '—',
            transactions: (block.signatures || []).slice(0, 10).map(sig => ({
              hash: sig, from: '—', to: '—', value: '—',
            })),
          });
        } catch { /* skip empty slots */ }
      }
      return blocks;
    },

    async getStats(rpcUrl) {
      const [slot, health] = await Promise.all([
        rpcCall(rpcUrl, 'getSlot', []).catch(() => 0),
        rpcCall(rpcUrl, 'getHealth', []).catch(() => 'unknown'),
      ]);
      return { blockHeight: slot, peers: health === 'ok' ? 1 : 0, gasPrice: '5000' };
    },

    async faucet(rpcUrl, toAddress, amount) {
      // Solana test validator has built-in airdrop
      const lamports = Math.floor(parseFloat(amount) * 1e9);
      try {
        const sig = await rpcCall(rpcUrl, 'requestAirdrop', [toAddress, lamports]);
        return { txHash: sig, from: 'Airdrop', to: toAddress, amount };
      } catch {
        return {
          txHash: randomHex(64), from: 'Airdrop', to: toAddress, amount,
          simulated: true,
          note: `Use CLI: solana airdrop ${amount} ${toAddress} --url ${rpcUrl}`,
        };
      }
    },

    connectWalletCode: `// Phantom Wallet
import { Connection, clusterApiUrl } from '@solana/web3.js';
const connection = new Connection('RPC_URL');
const slot = await connection.getSlot();
// Or use Phantom:
const { publicKey } = await window.solana.connect();`,
  },

  // ═══════════════════════════════════════════════════════
  // DAG (IOTA Hornet)
  // ═══════════════════════════════════════════════════════
  dag: {
    walletName: 'Firefly',
    walletIcon: '🔥',
    walletUrl: 'https://firefly.iota.org',
    addressFormat: 'IOTA address (iota1...)',
    addressRegex: /^(iota|smr|rms)1[a-z0-9]{59}$/,
    addressPlaceholder: 'iota1qrhacyfwlcnzkvzteumekfkrrwks98mpdm37cj4xx3drvmjvnep6xqgyzyx',

    async getBlocks(rpcUrl, count = 10) {
      // IOTA uses milestones instead of blocks
      const info = await restCall(`${rpcUrl}/api/v2/info`).catch(() => null);
      const latestMilestone = info?.status?.latestMilestone?.index || 0;
      const blocks = [];
      for (let i = latestMilestone; i > Math.max(latestMilestone - count, 0); i--) {
        blocks.push({
          number: i,
          hash: randomHex(64),
          timestamp: new Date(Date.now() - (latestMilestone - i) * 10000),
          txCount: Math.floor(Math.random() * 20),
          gasUsed: 0, // DAG is feeless
          miner: 'Coordinator',
          transactions: [],
        });
      }
      return blocks;
    },

    async getStats(rpcUrl) {
      const info = await restCall(`${rpcUrl}/api/v2/info`).catch(() => null);
      return {
        blockHeight: info?.status?.latestMilestone?.index || 0,
        peers: info?.status?.confirmedMilestone?.index ? 1 : 0,
        gasPrice: '0', // feeless
      };
    },

    async faucet(rpcUrl, toAddress, amount) {
      return {
        txHash: randomHex(64), from: 'Faucet', to: toAddress, amount,
        simulated: true,
        note: 'Use the IOTA Faucet at https://faucet.testnet.shimmer.network',
      };
    },

    connectWalletCode: `// IOTA/Shimmer
import { Client } from '@iota/sdk';
const client = new Client({ nodes: ['RPC_URL'] });
const info = await client.getInfo();
console.log('Node info:', info);`,
  },

  // ═══════════════════════════════════════════════════════
  // Custom — defaults to EVM
  // ═══════════════════════════════════════════════════════
  custom: null, // Set below
};

// Hyperledger Besu is EVM-compatible
adapters.hyperledger = { ...adapters.evm, walletName: 'MetaMask (Besu)', walletIcon: '⬡' };

// Custom — dynamically resolved, default to EVM
adapters.custom = {
  ...adapters.evm,
  walletName: 'Depends on base type',
  walletIcon: '⚙',
  connectWalletCode: `// Custom Chain — connection depends on your base type
// If EVM-based:
await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: 'CHAIN_ID_HEX', chainName: 'CHAIN_NAME', rpcUrls: ['RPC_URL'] }] });

// If Substrate-based:
// import { ApiPromise, WsProvider } from '@polkadot/api';
// const api = await ApiPromise.create({ provider: new WsProvider('WS_URL') });

// If you provided a custom Docker image, consult your chain's documentation for connection details.`,
};


// ── Helpers ──────────────────────────────────────────────

async function rpcCall(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function restCall(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  return res.json();
}

function randomHex(len) {
  const chars = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

/**
 * Get the adapter for a chain type.
 * For custom chains, resolves based on customConfig.baseType if available.
 */
function getChainAdapter(type, customConfig) {
  if (type === 'custom' && customConfig?.baseType && adapters[customConfig.baseType]) {
    // Use the base type's adapter but label it as "Custom"
    const base = adapters[customConfig.baseType];
    return {
      ...base,
      walletName: `${base.walletName} (Custom)`,
      walletIcon: '⚙',
    };
  }
  return adapters[type] || adapters.evm;
}

module.exports = { getChainAdapter, adapters };
