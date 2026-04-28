'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './docs.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

const SECTIONS = [
  {
    id: 'auth',
    title: '🔐 Authentication',
    endpoints: [
      {
        method: 'POST', path: '/api/auth/register',
        desc: 'Create a new account',
        body: '{\n  "email": "user@example.com",\n  "password": "securePassword123",\n  "username": "myuser"\n}',
        response: '{\n  "success": true,\n  "data": {\n    "user": { "email": "user@example.com", "username": "myuser" },\n    "token": "eyJhbGci..."\n  }\n}',
      },
      {
        method: 'POST', path: '/api/auth/login',
        desc: 'Login with email and password',
        body: '{\n  "email": "user@example.com",\n  "password": "securePassword123"\n}',
        response: '{\n  "success": true,\n  "data": { "user": {...}, "token": "eyJ..." }\n}',
      },
      {
        method: 'POST', path: '/api/auth/wallet',
        desc: 'Login with MetaMask wallet signature',
        body: '{\n  "walletAddress": "0x123...abc",\n  "signature": "0xsig...",\n  "message": "Sign in to ChainForge..."\n}',
        response: '{\n  "success": true,\n  "data": { "user": {...}, "token": "eyJ..." }\n}',
      },
      {
        method: 'GET', path: '/api/auth/me',
        desc: 'Get current user profile (requires Bearer token)',
        auth: true,
        response: '{\n  "success": true,\n  "data": { "user": { "email": "...", "plan": "free" } }\n}',
      },
    ],
  },
  {
    id: 'chains',
    title: '⛓ Chains',
    endpoints: [
      {
        method: 'GET', path: '/api/chains',
        desc: 'List all your chains',
        auth: true,
        response: '{\n  "success": true,\n  "data": { "chains": [...], "total": 3 }\n}',
      },
      {
        method: 'POST', path: '/api/chains',
        desc: 'Create a new blockchain',
        auth: true,
        body: '{\n  "name": "MyChain",\n  "type": "evm",\n  "chainId": 42069,\n  "symbol": "MYC",\n  "consensus": "poa",\n  "blockTime": 5,\n  "blockGasLimit": "30000000",\n  "token": {\n    "name": "MyChain Token",\n    "symbol": "MYC",\n    "decimals": 18,\n    "totalSupply": "1000000000"\n  }\n}',
        response: '{\n  "success": true,\n  "data": { "chain": { "_id": "...", "name": "MyChain", ... } }\n}',
      },
      {
        method: 'GET', path: '/api/chains/:id',
        desc: 'Get chain details by ID',
        auth: true,
        response: '{\n  "success": true,\n  "data": {\n    "chain": {\n      "name": "MyChain",\n      "status": "deployed",\n      "endpoints": {\n        "rpc": "http://...:9000",\n        "ws": "ws://...:9001"\n      },\n      "stats": { "blockHeight": 1234, "txCount": 56 }\n    }\n  }\n}',
      },
      {
        method: 'DELETE', path: '/api/chains/:id',
        desc: 'Delete a chain',
        auth: true,
        response: '{ "success": true }',
      },
    ],
  },
  {
    id: 'deploy',
    title: '🚀 Deployment',
    endpoints: [
      {
        method: 'POST', path: '/api/deploy/testnet/:chainId',
        desc: 'Deploy chain to testnet (free, 72h lifetime)',
        auth: true,
        response: '{\n  "success": true,\n  "data": {\n    "deployment": {\n      "status": "deploying",\n      "progress": 0\n    }\n  }\n}',
        note: 'Deployment is async. Subscribe to WebSocket for real-time progress.',
      },
      {
        method: 'POST', path: '/api/deploy/mainnet/:chainId',
        desc: 'Deploy to mainnet (requires payment)',
        auth: true,
        body: '{ "paymentId": "..." }',
        response: '{\n  "success": true,\n  "data": { "deployment": {...} }\n}',
      },
      {
        method: 'GET', path: '/api/deploy/logs/:chainId',
        desc: 'Get deployment container logs',
        auth: true,
        response: '{\n  "success": true,\n  "data": { "logs": "..." }\n}',
      },
    ],
  },
  {
    id: 'faucet',
    title: '💧 Faucet',
    endpoints: [
      {
        method: 'POST', path: '/api/faucet/:chainId',
        desc: 'Request test tokens (testnet only, 1 request/hour)',
        auth: true,
        body: '{\n  "address": "0xYourWalletAddress"\n}',
        response: '{\n  "success": true,\n  "data": {\n    "txHash": "0x...",\n    "amount": "10",\n    "symbol": "MYC",\n    "message": "10 MYC sent to 0x..."\n  }\n}',
      },
    ],
  },
  {
    id: 'templates',
    title: '📋 Templates',
    endpoints: [
      {
        method: 'GET', path: '/api/templates',
        desc: 'List all blockchain templates',
        response: '{\n  "success": true,\n  "data": [\n    { "id": "ethereum-clone", "name": "Ethereum Clone", "type": "evm" },\n    ...\n  ]\n}',
      },
    ],
  },
  {
    id: 'websocket',
    title: '📡 WebSocket Events',
    endpoints: [
      {
        method: 'WS', path: 'deployment:{deploymentId}',
        desc: 'Subscribe to deployment progress updates',
        response: '// Events emitted:\n"deployment:update" → { log, progress, status }\n"deployment:complete" → { endpoints, nodeInfo }\n"deployment:failed" → { error }',
        note: 'Use socket.io-client to connect.',
      },
      {
        method: 'WS', path: 'chain:{chainId}',
        desc: 'Subscribe to live chain telemetry (block height, tx count, peers)',
        response: '// Event: "chain:stats"\n{\n  "chainId": "...",\n  "blockHeight": 1234,\n  "txCount": 56,\n  "peers": 3,\n  "gasPrice": "1000000000"\n}',
      },
    ],
  },
];

const CODE_EXAMPLES = {
  javascript: {
    label: 'JavaScript',
    code: `// Connect to your chain with ethers.js
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider('YOUR_RPC_URL');

// Get latest block
const blockNumber = await provider.getBlockNumber();
console.log('Latest block:', blockNumber);

// Get balance
const balance = await provider.getBalance('0xYourAddress');
console.log('Balance:', ethers.formatEther(balance), 'TOKEN');

// Send transaction
const wallet = new ethers.Wallet('YOUR_PRIVATE_KEY', provider);
const tx = await wallet.sendTransaction({
  to: '0xRecipientAddress',
  value: ethers.parseEther('1.0'),
});
console.log('TX Hash:', tx.hash);`,
  },
  python: {
    label: 'Python',
    code: `# Connect to your chain with web3.py
from web3 import Web3

w3 = Web3(Web3.HTTPProvider('YOUR_RPC_URL'))

# Get latest block
print('Block:', w3.eth.block_number)

# Get balance
balance = w3.eth.get_balance('0xYourAddress')
print('Balance:', w3.from_wei(balance, 'ether'), 'TOKEN')

# Send transaction
tx = {
    'to': '0xRecipientAddress',
    'value': w3.to_wei(1, 'ether'),
    'gas': 21000,
    'nonce': w3.eth.get_transaction_count('0xYourAddress'),
}
signed = w3.eth.account.sign_transaction(tx, 'YOUR_PRIVATE_KEY')
tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
print('TX:', tx_hash.hex())`,
  },
  curl: {
    label: 'cURL',
    code: `# JSON-RPC calls to your chain

# Get block number
curl -X POST YOUR_RPC_URL \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Get balance
curl -X POST YOUR_RPC_URL \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"eth_getBalance","params":["0xAddress","latest"],"id":1}'

# Get gas price
curl -X POST YOUR_RPC_URL \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}'`,
  },
};

export default function DocsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('auth');
  const [codeLang, setCodeLang] = useState('javascript');

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader} onClick={() => router.push('/')}>
          <span className={styles.logo}>⛓️</span>
          <span className={styles.logoText}>ChainForge</span>
        </div>
        <nav className={styles.nav}>
          <p className={styles.navLabel}>API Reference</p>
          {SECTIONS.map(s => (
            <button key={s.id} className={`${styles.navItem} ${activeSection === s.id ? styles.navActive : ''}`}
              onClick={() => setActiveSection(s.id)}>
              {s.title}
            </button>
          ))}
          <p className={styles.navLabel}>Code Examples</p>
          <button className={`${styles.navItem} ${activeSection === 'examples' ? styles.navActive : ''}`}
            onClick={() => setActiveSection('examples')}>
            💻 SDK Examples
          </button>
          <button className={`${styles.navItem} ${activeSection === 'ratelimits' ? styles.navActive : ''}`}
            onClick={() => setActiveSection('ratelimits')}>
            ⚡ Rate Limits
          </button>
        </nav>
        <button className={styles.backToDash} onClick={() => router.push('/dashboard')}>← Dashboard</button>
      </aside>

      {/* Content */}
      <main className={styles.main}>
        <div className={styles.baseUrl}>
          <span>Base URL</span>
          <code>{API_BASE}</code>
        </div>

        {/* API Sections */}
        {SECTIONS.filter(s => s.id === activeSection).map(section => (
          <div key={section.id}>
            <h1 className={styles.sectionTitle}>{section.title}</h1>
            {section.endpoints.map((ep, i) => (
              <div key={i} className={styles.endpoint}>
                <div className={styles.endpointHeader}>
                  <span className={`${styles.method} ${styles['method' + ep.method]}`}>{ep.method}</span>
                  <code className={styles.path}>{ep.path}</code>
                  {ep.auth && <span className={styles.authBadge}>🔒 Auth</span>}
                </div>
                <p className={styles.endpointDesc}>{ep.desc}</p>
                {ep.note && <div className={styles.note}>💡 {ep.note}</div>}
                {ep.body && (
                  <div className={styles.codeSection}>
                    <span className={styles.codeLabel}>Request Body</span>
                    <pre className={styles.code}>{ep.body}</pre>
                  </div>
                )}
                <div className={styles.codeSection}>
                  <span className={styles.codeLabel}>Response</span>
                  <pre className={styles.code}>{ep.response}</pre>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Code Examples */}
        {activeSection === 'examples' && (
          <div>
            <h1 className={styles.sectionTitle}>💻 SDK & Code Examples</h1>
            <p className={styles.sectionDesc}>Connect to your deployed blockchain using popular languages and libraries.</p>
            <div className={styles.langTabs}>
              {Object.entries(CODE_EXAMPLES).map(([key, val]) => (
                <button key={key} className={`${styles.langTab} ${codeLang === key ? styles.langActive : ''}`}
                  onClick={() => setCodeLang(key)}>
                  {val.label}
                </button>
              ))}
            </div>
            <pre className={styles.codeBlock}>{CODE_EXAMPLES[codeLang].code}</pre>
          </div>
        )}

        {/* Rate Limits */}
        {activeSection === 'ratelimits' && (
          <div>
            <h1 className={styles.sectionTitle}>⚡ Rate Limits</h1>
            <p className={styles.sectionDesc}>API rate limits to ensure fair usage and platform stability.</p>
            <table className={styles.table}>
              <thead>
                <tr><th>Endpoint Group</th><th>Limit</th><th>Window</th></tr>
              </thead>
              <tbody>
                <tr><td>General API</td><td>200 requests</td><td>15 minutes</td></tr>
                <tr><td>Authentication</td><td>20 requests</td><td>15 minutes</td></tr>
                <tr><td>Deployment</td><td>10 requests</td><td>1 hour</td></tr>
                <tr><td>Payment</td><td>30 requests</td><td>15 minutes</td></tr>
                <tr><td>Faucet</td><td>5 requests</td><td>15 minutes</td></tr>
                <tr><td>Blockchain RPC</td><td>Unlimited</td><td>—</td></tr>
              </tbody>
            </table>
            <div className={styles.note}>💡 Rate limits are per IP address. If you need higher limits, upgrade to an Enterprise plan.</div>
          </div>
        )}
      </main>
    </div>
  );
}
