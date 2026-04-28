/**
 * ChainForge — Faucet Service (Multi-Chain)
 *
 * Sends test tokens using chain-specific adapters.
 * EVM → eth_sendTransaction from dev account
 * Substrate → Simulated (use Polkadot.js Apps)
 * Cosmos → Simulated (use gaiad CLI)
 * Solana → requestAirdrop
 * DAG → Simulated
 */
const { getChainAdapter } = require('./chainAdapters');

const FAUCET_AMOUNTS = {
  evm: '10', hyperledger: '10', substrate: '100',
  cosmos: '1000', solana: '100', dag: '1000', custom: '10',
};

const FAUCET_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const cooldowns = new Map();

/**
 * Send test tokens on any chain type
 */
async function sendFaucetTokens(chain, toAddress, userId) {
  // Cooldown check
  const key = `${userId}:${chain._id}`;
  const last = cooldowns.get(key);
  if (last && Date.now() - last < FAUCET_COOLDOWN_MS) {
    const mins = Math.ceil((FAUCET_COOLDOWN_MS - (Date.now() - last)) / 60000);
    throw new Error(`Faucet cooldown: wait ${mins} minutes.`);
  }

  if (chain.network === 'mainnet') throw new Error('Faucet is testnet only.');
  if (chain.status !== 'deployed') throw new Error('Chain must be deployed first.');

  const rpcUrl = chain.endpoints?.rpc;
  if (!rpcUrl) throw new Error('Chain has no RPC endpoint.');

  const adapter = getChainAdapter(chain.type);
  const amount = FAUCET_AMOUNTS[chain.type] || '10';

  // Validate address format
  if (adapter.addressRegex && !adapter.addressRegex.test(toAddress)) {
    throw new Error(`Invalid ${chain.type} address. Expected format: ${adapter.addressFormat}`);
  }

  let result;
  try {
    result = await adapter.faucet(rpcUrl, toAddress, amount);
  } catch (err) {
    console.warn(`Faucet ${chain.type} failed:`, err.message);
    // Fallback to simulated
    result = {
      txHash: '0x' + require('crypto').randomBytes(32).toString('hex'),
      from: 'faucet', to: toAddress, amount,
      simulated: true,
      note: `${chain.type} faucet: ${amount} tokens (simulated). Check chain docs for manual faucet.`,
    };
  }

  cooldowns.set(key, Date.now());

  return {
    ...result,
    symbol: chain.token?.symbol || chain.config?.symbol || 'TOKEN',
    walletName: adapter.walletName,
    walletUrl: adapter.walletUrl,
  };
}

module.exports = { sendFaucetTokens };
