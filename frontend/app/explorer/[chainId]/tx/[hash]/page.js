'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../../lib/api';
import styles from '../../../public-explorer.module.css';

export default function TxDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { chainId, hash } = params;

  const [chain, setChain] = useState(null);
  const [tx, setTx] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch chain info
  useEffect(() => {
    async function loadChain() {
      try {
        const res = await api.getPublicChain(chainId);
        if (res.success) {
          setChain(res.data.chain);
        } else {
          setError(res.error || 'Chain not found');
        }
      } catch (err) {
        setError('Failed to load blockchain network');
      }
    }
    if (chainId) loadChain();
  }, [chainId]);

  // Fetch Tx Data
  useEffect(() => {
    if (!chain || chain.status !== 'deployed' || !chain.endpoints?.rpc) {
      if (chain && chain.status !== 'deployed') setLoading(false);
      return;
    }

    const fetchTxData = async () => {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/rpc/${chain._id}`
          : `${window.location.origin}/api/rpc/${chain._id}`;

        const [txRes, receiptRes] = await Promise.all([
          fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionByHash', params: [hash], id: 1 })
          }).then(r => r.json()),
          fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [hash], id: 2 })
          }).then(r => r.json())
        ]);

        if (txRes.result) {
          setTx(txRes.result);
          if (receiptRes.result) setReceipt(receiptRes.result);
        } else {
          setError('Transaction not found');
        }
      } catch (err) {
        setError('Failed to fetch transaction data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTxData();
  }, [chain, hash]);

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    if (/^0x[0-9a-fA-F]{64}$/.test(query)) {
      router.push(`/explorer/${chainId}/tx/${query}`);
    } else if (/^0x[0-9a-fA-F]{40}$/.test(query)) {
      router.push(`/explorer/${chainId}/address/${query}`);
    } else if (/^\d+$/.test(query)) {
      router.push(`/explorer/${chainId}/block/${query}`);
    } else {
      alert('Invalid search query.');
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Fetching Transaction Details...</p>
      </div>
    );
  }

  if (error || !chain) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => router.push(`/explorer/${chainId}`)} className="btn btn-primary mt-4">Back to Explorer</button>
      </div>
    );
  }

  return (
    <div className={styles.explorerPage}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <div className={styles.brand} onClick={() => router.push(`/explorer/${chainId}`)} style={{ cursor: 'pointer' }}>
            <div className={styles.logoIcon}>⛓️</div>
            <div className={styles.brandName}>
              {chain.name} <span className={styles.scanText}>Scan</span>
            </div>
          </div>
          <form className={styles.searchForm} onSubmit={handleSearch} style={{ flex: 1, maxWidth: '500px', marginLeft: '2rem' }}>
            <div className={styles.searchBox} style={{ height: '40px' }}>
              <input 
                type="text" 
                placeholder="Search by Address / Txn Hash / Block"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className={styles.searchBtn}>🔍</button>
            </div>
          </form>
          <div className={styles.navLinks}>
            <span className={styles.navLink} onClick={() => router.push(`/explorer/${chainId}`)}>Home</span>
            <span className={styles.navLink} onClick={() => router.push(`/explorer/${chainId}/bridge`)}>Bridge</span>
            <span className={styles.navLink} onClick={() => router.push(`/explorer/${chainId}/staking`)}>Staking</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.contentSection} style={{ marginTop: '2rem', maxWidth: '1000px' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Transaction Details</h1>
        
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Overview</h2>
          </div>
          <div className={styles.cardBody} style={{ padding: '1rem' }}>
            
            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Transaction Hash:</div>
              <div style={{ width: '75%', wordBreak: 'break-all' }}>{tx?.hash}</div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Status:</div>
              <div style={{ width: '75%' }}>
                {receipt ? (
                  parseInt(receipt.status, 16) === 1 ? (
                    <span className={styles.badgeSuccess}>✅ Success</span>
                  ) : (
                    <span style={{ background: '#fef2f2', color: '#dc2626', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.85rem' }}>❌ Failed</span>
                  )
                ) : (
                  <span className={styles.badge}>Pending</span>
                )}
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Block:</div>
              <div style={{ width: '75%' }}>
                {tx?.blockNumber ? (
                  <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/block/${parseInt(tx.blockNumber, 16)}`)}>
                    {parseInt(tx.blockNumber, 16)}
                  </span>
                ) : 'Pending'}
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>From:</div>
              <div style={{ width: '75%' }}>
                <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${tx?.from}`)}>
                  {tx?.from}
                </span>
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>To:</div>
              <div style={{ width: '75%' }}>
                {tx?.to ? (
                  <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${tx?.to}`)}>
                    {tx?.to}
                  </span>
                ) : (
                  <span>Contract Creation</span>
                )}
              </div>
            </div>

            <hr style={{ margin: '1rem 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Value:</div>
              <div style={{ width: '75%' }}>
                {tx?.value ? (parseInt(tx.value, 16) / 1e18).toFixed(18).replace(/\.?0+$/, '') : '0'} {chain.token?.symbol}
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Transaction Fee:</div>
              <div style={{ width: '75%' }}>
                {receipt && tx ? (
                  ((parseInt(receipt.gasUsed, 16) * parseInt(tx.gasPrice, 16)) / 1e18).toFixed(8)
                ) : '—'} {chain.token?.symbol}
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Gas Price:</div>
              <div style={{ width: '75%' }}>
                {tx?.gasPrice ? (parseInt(tx.gasPrice, 16) / 1e9).toFixed(2) : '—'} Gwei
              </div>
            </div>

          </div>
        </div>
      </main>
      
      <footer className={styles.footer} style={{ marginTop: 'auto' }}>
        <div className={styles.footerInner}>
          Powered by ChainForge Infrastructure
        </div>
      </footer>
    </div>
  );
}
