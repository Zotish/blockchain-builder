'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../lib/api';
import styles from './explorer.module.css';

// Generate mock blocks for demo
function generateMockBlocks(count = 20) {
  const blocks = [];
  for (let i = count; i > 0; i--) {
    blocks.push({
      number: i,
      hash: `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
      parentHash: `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
      timestamp: Date.now() - (count - i) * 12000,
      transactions: Math.floor(Math.random() * 15),
      gasUsed: Math.floor(Math.random() * 15000000),
      gasLimit: 30000000,
      miner: `0x${Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
      size: Math.floor(Math.random() * 5000) + 500,
    });
  }
  return blocks;
}

function generateMockTxs(count = 15) {
  const txs = [];
  for (let i = 0; i < count; i++) {
    txs.push({
      hash: `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
      from: `0x${Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
      to: `0x${Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
      value: (Math.random() * 100).toFixed(4),
      gasPrice: Math.floor(Math.random() * 50) + 1,
      blockNumber: Math.floor(Math.random() * 20) + 1,
      status: Math.random() > 0.1 ? 'success' : 'failed',
      timestamp: Date.now() - i * 8000,
    });
  }
  return txs;
}

// Inner component — uses useSearchParams, must be inside Suspense
function ExplorerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState('blocks');
  const [blocks] = useState(generateMockBlocks());
  const [transactions] = useState(generateMockTxs());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChain, setSelectedChain] = useState(null);
  const [chains, setChains] = useState([]);

  useEffect(() => {
    loadChains();
  }, []);

  const loadChains = async () => {
    try {
      if (api.token) {
        const res = await api.getChains();
        if (res.success) setChains(res.data.chains);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const truncateHash = (hash) => hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : '';
  const truncateAddr = (addr) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '';
  const timeAgo = (ts) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  };

  return (
    <div className={styles.explorerPage}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <div className={styles.logo} onClick={() => router.push('/')}>
              <span>⛓️</span>
              <span className={styles.logoText}>Chain<span className={styles.logoAccent}>Forge</span></span>
            </div>
            <span className={styles.headerDivider}>|</span>
            <span className={styles.headerTitle}>Block Explorer</span>
          </div>
          <div className={styles.headerActions}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>Dashboard</button>
            <button className="btn btn-primary btn-sm" onClick={() => router.push('/builder')}>+ New Chain</button>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {/* Search Bar */}
        <div className={styles.searchSection}>
          <h1 className={styles.searchTitle}>
            <span className="gradient-text">Block Explorer</span>
          </h1>
          <p className={styles.searchSubtitle}>Search blocks, transactions, and addresses on your chain</p>
          <div className={styles.searchBar}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by block number, tx hash, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="btn btn-primary btn-sm">Search</button>
          </div>
        </div>

        {/* Network Stats */}
        <div className={styles.networkStats}>
          <div className={styles.netStat}>
            <span className={styles.netStatLabel}>Latest Block</span>
            <span className={styles.netStatValue}>#{blocks[0]?.number || 0}</span>
          </div>
          <div className={styles.netStat}>
            <span className={styles.netStatLabel}>Total Txns</span>
            <span className={styles.netStatValue}>{transactions.length}</span>
          </div>
          <div className={styles.netStat}>
            <span className={styles.netStatLabel}>Avg Block Time</span>
            <span className={styles.netStatValue}>5.0s</span>
          </div>
          <div className={styles.netStat}>
            <span className={styles.netStatLabel}>Network</span>
            <span className={`badge badge-info`}>Testnet</span>
          </div>
        </div>

        {/* View Toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.toggleBtn} ${activeView === 'blocks' ? styles.toggleActive : ''}`}
            onClick={() => setActiveView('blocks')}
          >
            📦 Latest Blocks
          </button>
          <button
            className={`${styles.toggleBtn} ${activeView === 'transactions' ? styles.toggleActive : ''}`}
            onClick={() => setActiveView('transactions')}
          >
            📄 Latest Transactions
          </button>
        </div>

        {/* Content */}
        {activeView === 'blocks' ? (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Hash</th>
                  <th>Txns</th>
                  <th>Gas Used</th>
                  <th>Miner</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.number}>
                    <td>
                      <span className={styles.blockNum}>#{block.number}</span>
                    </td>
                    <td>
                      <span className={styles.hash}>{truncateHash(block.hash)}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${block.transactions > 0 ? 'primary' : 'info'}`}>
                        {block.transactions}
                      </span>
                    </td>
                    <td>
                      <div className={styles.gasBar}>
                        <div className={styles.gasBarFill} style={{ width: `${(block.gasUsed / block.gasLimit) * 100}%` }}></div>
                      </div>
                      <span className={styles.gasText}>{Math.round(block.gasUsed / block.gasLimit * 100)}%</span>
                    </td>
                    <td>
                      <span className={styles.address}>{truncateAddr(block.miner)}</span>
                    </td>
                    <td>
                      <span className={styles.time}>{timeAgo(block.timestamp)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tx Hash</th>
                  <th>Block</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.hash}>
                    <td>
                      <span className={styles.hash}>{truncateHash(tx.hash)}</span>
                    </td>
                    <td>
                      <span className={styles.blockNum}>#{tx.blockNumber}</span>
                    </td>
                    <td>
                      <span className={styles.address}>{truncateAddr(tx.from)}</span>
                    </td>
                    <td>
                      <span className={styles.address}>{truncateAddr(tx.to)}</span>
                    </td>
                    <td>
                      <span className={styles.value}>{tx.value} ETH</span>
                    </td>
                    <td>
                      <span className={`badge badge-${tx.status === 'success' ? 'success' : 'danger'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td>
                      <span className={styles.time}>{timeAgo(tx.timestamp)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
// Outer page — wraps ExplorerContent in Suspense boundary
export default function ExplorerPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#94a3b8' }}>
        Loading Explorer...
      </div>
    }>
      <ExplorerContent />
    </Suspense>
  );
}
