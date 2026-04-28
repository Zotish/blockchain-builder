/**
 * ChainForge — Faucet Service
 *
 * Sends test tokens to users on testnet chains.
 * Uses the pre-funded dev account on each chain's RPC endpoint.
 */
const { ethers } = require('ethers');

// Faucet limits per chain
const FAUCET_AMOUNTS = {
  evm:         '10',       // 10 ETH equivalent
  hyperledger: '10',
  substrate:   '100',      // 100 tokens
  cosmos:      '1000',     // 1000 stake
  solana:      '100',      // 100 SOL
  dag:         '1000',
  custom:      '10',
};

const FAUCET_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between requests
const faucetCooldowns = new Map(); // userId:chainId → lastRequest timestamp

/**
 * Send test tokens on an EVM chain
 */
async function faucetEVM(rpcUrl, toAddress, amount) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // In --dev mode, Geth pre-funds the coinbase/dev account
  // We can use eth_sendTransaction from the unlocked dev account
  // or use the personal_sendTransaction method

  // Method 1: Use the dev account (account[0]) which is pre-funded
  const accounts = await provider.send('eth_accounts', []);
  if (!accounts || accounts.length === 0) {
    throw new Error('No dev accounts available on this chain.');
  }

  const devAccount = accounts[0];
  const amountWei = ethers.parseEther(amount);

  // Send via personal_sendTransaction (dev mode has unlocked accounts)
  const txHash = await provider.send('eth_sendTransaction', [{
    from: devAccount,
    to: toAddress,
    value: '0x' + amountWei.toString(16),
    gas: '0x5208', // 21000
  }]);

  // Wait for receipt
  let receipt = null;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) break;
  }

  return {
    txHash,
    from: devAccount,
    to: toAddress,
    amount,
    blockNumber: receipt?.blockNumber || null,
  };
}

/**
 * Non-EVM faucet placeholder — returns simulated result
 * Real implementation would use chain-specific SDKs
 */
async function faucetNonEVM(chainType, toAddress, amount) {
  return {
    txHash: '0x' + require('crypto').randomBytes(32).toString('hex'),
    from: 'faucet',
    to: toAddress,
    amount,
    simulated: true,
    note: `${chainType} faucet: ${amount} tokens sent (simulated)`,
  };
}

/**
 * Main faucet function
 * @param {object} chain - Chain document from MongoDB
 * @param {string} toAddress - Recipient wallet address
 * @param {string} userId - To enforce cooldown
 */
async function sendFaucetTokens(chain, toAddress, userId) {
  // Check cooldown
  const cooldownKey = `${userId}:${chain._id}`;
  const lastRequest = faucetCooldowns.get(cooldownKey);
  if (lastRequest && Date.now() - lastRequest < FAUCET_COOLDOWN_MS) {
    const remaining = Math.ceil((FAUCET_COOLDOWN_MS - (Date.now() - lastRequest)) / 60000);
    throw new Error(`Faucet cooldown: please wait ${remaining} minutes before requesting again.`);
  }

  // Only works on testnet
  if (chain.network === 'mainnet') {
    throw new Error('Faucet is only available on testnet chains.');
  }

  if (chain.status !== 'deployed') {
    throw new Error('Chain must be deployed to use the faucet.');
  }

  const rpcUrl = chain.endpoints?.rpc;
  if (!rpcUrl) throw new Error('Chain has no RPC endpoint.');

  const amount = FAUCET_AMOUNTS[chain.type] || '10';
  let result;

  if (['evm', 'hyperledger', 'custom'].includes(chain.type)) {
    // Validate ETH address
    if (!toAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Invalid EVM address format.');
    }
    try {
      result = await faucetEVM(rpcUrl, toAddress, amount);
    } catch (err) {
      // If real RPC fails, return simulated result
      console.warn('EVM faucet RPC failed, simulating:', err.message);
      result = await faucetNonEVM(chain.type, toAddress, amount);
    }
  } else {
    result = await faucetNonEVM(chain.type, toAddress, amount);
  }

  // Set cooldown
  faucetCooldowns.set(cooldownKey, Date.now());

  return {
    ...result,
    symbol: chain.token?.symbol || chain.config?.symbol || 'TOKEN',
  };
}

module.exports = { sendFaucetTokens };
