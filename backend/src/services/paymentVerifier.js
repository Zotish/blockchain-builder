/**
 * ChainForge — Payment Verification Service
 *
 * Verifies crypto transactions on-chain using ethers.js.
 * Supports: ETH, BNB, MATIC (native transfers), USDT/USDC (ERC-20).
 */
const { ethers } = require('ethers');

// RPC endpoints per network
const RPC_URLS = {
  ETH:  process.env.ETH_RPC  || 'https://eth.llamarpc.com',
  BNB:  process.env.BSC_RPC  || 'https://bsc-dataseed1.binance.org',
  MATIC: process.env.POLY_RPC || 'https://polygon-rpc.com',
  USDT: process.env.ETH_RPC  || 'https://eth.llamarpc.com', // ERC-20 on ETH
  USDC: process.env.ETH_RPC  || 'https://eth.llamarpc.com',
};

// ERC-20 contract addresses (Mainnet)
const ERC20_CONTRACTS = {
  USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
};

// Minimal ERC-20 ABI for Transfer event
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
];

// Confirmation blocks required
const CONFIRMATIONS_REQUIRED = {
  ETH:   3,
  BNB:   5,
  MATIC: 10,
  USDT:  3,
  USDC:  3,
};

/**
 * Verify a native coin transfer (ETH, BNB, MATIC)
 */
async function verifyNativeTransfer(txHash, expectedTo, expectedAmountEth, currency) {
  const rpcUrl = RPC_URLS[currency];
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new Error(`Transaction ${txHash} not found on ${currency} network.`);

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error('Transaction not yet mined. Please wait for confirmation.');
  if (receipt.status !== 1) throw new Error('Transaction failed on-chain.');

  // Check confirmations
  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber;
  const required = CONFIRMATIONS_REQUIRED[currency] || 3;
  if (confirmations < required) {
    throw new Error(`Transaction needs ${required} confirmations, has ${confirmations}. Please wait.`);
  }

  // Check recipient
  if (tx.to?.toLowerCase() !== expectedTo.toLowerCase()) {
    throw new Error(`Payment sent to wrong address. Expected: ${expectedTo}, got: ${tx.to}`);
  }

  // Check amount (allow 0.5% tolerance for gas/rounding)
  const sentAmount = parseFloat(ethers.formatEther(tx.value));
  const expectedAmount = parseFloat(expectedAmountEth);
  const tolerance = expectedAmount * 0.005;

  if (sentAmount < expectedAmount - tolerance) {
    throw new Error(
      `Insufficient payment. Expected: ${expectedAmount} ${currency}, received: ${sentAmount.toFixed(6)} ${currency}`
    );
  }

  return {
    verified: true,
    txHash,
    from: tx.from,
    to: tx.to,
    amount: sentAmount.toString(),
    currency,
    blockNumber: receipt.blockNumber,
    confirmations,
  };
}

/**
 * Verify an ERC-20 token transfer (USDT, USDC)
 */
async function verifyERC20Transfer(txHash, expectedTo, expectedAmountUsd, currency) {
  const rpcUrl = RPC_URLS[currency];
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contractAddr = ERC20_CONTRACTS[currency];

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error('Transaction not yet mined.');
  if (receipt.status !== 1) throw new Error('Transaction failed on-chain.');

  const currentBlock = await provider.getBlockNumber();
  const confirmations = currentBlock - receipt.blockNumber;
  if (confirmations < CONFIRMATIONS_REQUIRED[currency]) {
    throw new Error(`Needs ${CONFIRMATIONS_REQUIRED[currency]} confirmations. Current: ${confirmations}`);
  }

  // Decode Transfer event from logs
  const contract = new ethers.Contract(contractAddr, ERC20_ABI, provider);
  const decimals = await contract.decimals();

  const transferLog = receipt.logs.find(
    log => log.address.toLowerCase() === contractAddr.toLowerCase()
  );
  if (!transferLog) throw new Error(`No ${currency} transfer found in this transaction.`);

  const parsed = contract.interface.parseLog(transferLog);
  if (!parsed) throw new Error('Could not parse transfer log.');

  const toAddress = parsed.args[1];
  const rawAmount = parsed.args[2];

  if (toAddress.toLowerCase() !== expectedTo.toLowerCase()) {
    throw new Error(`Payment sent to wrong address. Expected: ${expectedTo}`);
  }

  const sentAmount = parseFloat(ethers.formatUnits(rawAmount, decimals));
  const expectedAmount = parseFloat(expectedAmountUsd);
  const tolerance = expectedAmount * 0.005;

  if (sentAmount < expectedAmount - tolerance) {
    throw new Error(`Insufficient payment. Expected: $${expectedAmount}, received: $${sentAmount.toFixed(2)}`);
  }

  return {
    verified: true,
    txHash,
    from: receipt.from,
    to: toAddress,
    amount: sentAmount.toString(),
    currency,
    blockNumber: receipt.blockNumber,
    confirmations,
  };
}

/**
 * Main verification function — dispatches based on currency type
 */
async function verifyPayment(txHash, currency, expectedTo, expectedAmount) {
  if (!txHash.match(/^0x[a-fA-F0-9]{64}$/)) {
    throw new Error('Invalid transaction hash format.');
  }

  const nativeCurrencies = ['ETH', 'BNB', 'MATIC'];
  const erc20Currencies  = ['USDT', 'USDC'];

  if (nativeCurrencies.includes(currency)) {
    return verifyNativeTransfer(txHash, expectedTo, expectedAmount, currency);
  }

  if (erc20Currencies.includes(currency)) {
    // Convert ETH price to USD equivalent for USDT/USDC
    const usdAmount = await ethToUsd(expectedAmount);
    return verifyERC20Transfer(txHash, expectedTo, usdAmount, currency);
  }

  throw new Error(`Unsupported currency: ${currency}`);
}

/**
 * Simple ETH → USD conversion using CoinGecko free API
 */
async function ethToUsd(ethAmount) {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const price = data?.ethereum?.usd || 3000; // fallback price
    return parseFloat(ethAmount) * price;
  } catch {
    return parseFloat(ethAmount) * 3000; // fallback
  }
}

module.exports = { verifyPayment };
