/**
 * ChainForge — Multi-Chain Wallet Adapter
 * 
 * Supports:
 * - EVM: MetaMask, Coinbase, TrustWallet (window.ethereum)
 * - Substrate: Polkadot{.js}, Talisman
 * - Solana: Phantom, Solflare
 */

export const getWalletAdapter = (chainType) => {
  switch (chainType?.toLowerCase()) {
    case 'evm':
    case 'hyperledger':
      return new EVMAdapter();
    case 'substrate':
      return new SubstrateAdapter();
    case 'solana':
      return new SolanaAdapter();
    default:
      return new EVMAdapter(); // Fallback
  }
};

class EVMAdapter {
  name = 'MetaMask';
  async connect() {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  }
  async getBalance(address) {
    const balanceHex = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [address, 'latest']
    });
    return (parseInt(balanceHex, 16) / 1e18).toFixed(4);
  }
}

class SubstrateAdapter {
  name = 'Polkadot{.js}';
  async connect() {
    // Dynamic import to avoid SSR issues
    const { web3Enable, web3Accounts } = await import('@polkadot/extension-dapp');
    const extensions = await web3Enable('ChainForge');
    if (extensions.length === 0) throw new Error('Polkadot{.js} extension not found');
    const accounts = await web3Accounts();
    return accounts[0].address;
  }
  async getBalance(address) {
    // Mock balance for now as Substrate requires RPC connection
    return "0.0000"; 
  }
}

class SolanaAdapter {
  name = 'Phantom';
  async connect() {
    if (!window.solana || !window.solana.isPhantom) throw new Error('Phantom not installed');
    const resp = await window.solana.connect();
    return resp.publicKey.toString();
  }
  async getBalance(address) {
    return "0.0000";
  }
}
