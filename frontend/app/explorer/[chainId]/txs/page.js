'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import styles from '../public-explorer.module.css';

export default function ViewAllTxsPage() {
  const params = useParams();
  const router = useRouter();
  const { chainId } = params;

  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.getPublicChain(chainId);
        if (res.success) {
          setChain(res.data.chain);
        }
      } catch (err) {
        console.error('Failed to load chain:', err);
      } finally {
        setLoading(false);
      }
    }
    if (chainId) loadData();
  }, [chainId]);

  useEffect(() => {
    if (!chain || !chain.endpoints?.rpc) return;

    const rpcUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/rpc/${chain._id}`
      : `${window.location.origin}/api/rpc/${chain._id}`;

    const fetchTxs = async () => {
      try {
        let latestNum = 0;
        const chainType = chain.type || 'evm';

        // 1. Get latest height
        if (chainType === 'substrate') {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'chain_getHeader', params: [], id: 1 })
          });
          const data = await res.json();
          if (data.result) latestNum = parseInt(data.result.number, 16);
        } else if (chainType === 'cosmos') {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'status', params: [], id: 1 })
          });
          const data = await res.json();
          if (data.result) latestNum = parseInt(data.result.sync_info.latest_block_height);
        } else {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
          });
          const data = await res.json();
          if (data.result) latestNum = parseInt(data.result, 16);
        }

        if (!latestNum) return;

        // 2. Fetch last few blocks and extract txs
        const blockPromises = [];
        const count = 10; // Check last 10 blocks for txs

        if (chainType === 'evm' || chainType === 'hyperledger' || chainType === 'custom') {
          for (let i = latestNum; i > Math.max(-1, latestNum - count); i--) {
            blockPromises.push(
              fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: ['0x' + i.toString(16), true], id: i })
              }).then(r => r.json()).then(d => d.result)
            );
          }
        } else if (chainType === 'cosmos') {
          for (let i = latestNum; i > Math.max(0, latestNum - count); i--) {
            blockPromises.push(
              fetch(`${rpcUrl}/block?height=${i}`).then(r => r.json()).then(d => d.result)
            );
          }
        }

        const blockResults = await Promise.all(blockPromises);
        const allTxs = [];

        blockResults.filter(Boolean).forEach(b => {
          let txs = [];
          let timestamp = 0;
          let blockNumber = 0;

          if (chainType === 'evm' || chainType === 'hyperledger' || chainType === 'custom') {
            txs = b.transactions || [];
            timestamp = parseInt(b.timestamp, 16) * 1000;
            blockNumber = parseInt(b.number, 16);
          } else if (chainType === 'cosmos') {
            txs = b.block.data.txs || [];
            timestamp = new Date(b.block.header.time).getTime();
            blockNumber = parseInt(b.block.header.height);
          }

          txs.forEach((tx, idx) => {
            allTxs.push({
              hash: tx.hash || `cosmos-tx-${blockNumber}-${idx}`,
              from: tx.from || 'Unknown',
              to: tx.to || 'Unknown',
              value: tx.value || '0x0',
              blockNumber,
              timestamp
            });
          });
        });

        allTxs.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(allTxs.slice(0, 50));
      } catch (err) {
        console.warn('Failed to fetch txs:', err);
      }
    };

    fetchTxs();
    const interval = setInterval(fetchTxs, 10000);
    return () => clearInterval(interval);
  }, [chain]);

  const truncateHash = (hash) => hash ? `${hash.slice(0, 14)}...${hash.slice(-10)}` : 'Unknown';
  const truncateAddr = (addr) => addr ? `${addr.slice(0, 10)}...${addr.slice(-8)}` : 'Unknown';
  
  const timeAgo = (ts) => {
    if (!ts) return '';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  };

  if (loading) return <div className={styles.loadingContainer}><div className={styles.spinner}></div></div>;
  if (!chain) return <div className={styles.errorContainer}><h2>Chain not found</h2></div>;

  return (
    <div className={styles.explorerPage}>
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <div className={styles.brand} onClick={() => router.push(`/explorer/${chainId}`)}>
            <div className={styles.logoIcon}>⛓️</div>
            <div className={styles.brandName}>{chain.name} <span className={styles.scanText}>Scan</span></div>
          </div>
        </div>
      </header>

      <main className={styles.contentSection} style={{ marginTop: '2rem' }}>
        <div className={styles.tableTitleSection}>
          <h2>Transactions</h2>
          <div className={styles.subText}>Showing the latest {transactions.length} transactions</div>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.explorerTable}>
              <thead>
                <tr>
                  <th>Txn Hash</th>
                  <th>Block</th>
                  <th>Age</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.hash}>
                    <td><span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/tx/${tx.hash}`)}>{truncateHash(tx.hash)}</span></td>
                    <td><span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/block/${tx.blockNumber}`)}>{tx.blockNumber}</span></td>
                    <td>{timeAgo(tx.timestamp)}</td>
                    <td><span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${tx.from}`)}>{truncateAddr(tx.from)}</span></td>
                    <td>{tx.to === 'Unknown' ? 'Contract Creation' : <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${tx.to}`)}>{truncateAddr(tx.to)}</span>}</td>
                    <td>
                      <div className={styles.badgeSuccess}>
                        {tx.value === '0x0' ? '0' : (parseInt(tx.value, 16) / 1e18).toFixed(4)} {chain.token?.symbol}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {transactions.length === 0 && <div className={styles.emptyState}>No transactions found.</div>}
        </div>
      </main>

      <footer className={styles.footer}>Powered by ChainForge Infrastructure</footer>
    </div>
  );
}
