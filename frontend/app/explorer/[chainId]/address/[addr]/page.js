'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../../lib/api';
import styles from '../../public-explorer.module.css';

export default function AddressDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { chainId, addr } = params;

  const [chain, setChain] = useState(null);
  const [balance, setBalance] = useState(null);
  const [txCount, setTxCount] = useState(null);
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

  // Fetch Address Data
  useEffect(() => {
    if (!chain || chain.status !== 'deployed' || !chain.endpoints?.rpc) {
      if (chain && chain.status !== 'deployed') setLoading(false);
      return;
    }

    const fetchAddressData = async () => {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/rpc/${chain._id}`
          : `${window.location.origin}/api/rpc/${chain._id}`;

        const [balRes, countRes] = await Promise.all([
          fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [addr, 'latest'], id: 1 })
          }).then(r => r.json()),
          fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getTransactionCount', params: [addr, 'latest'], id: 2 })
          }).then(r => r.json())
        ]);

        if (balRes.result !== undefined) {
          setBalance(balRes.result);
          setTxCount(countRes.result || '0x0');
        } else {
          setError('Could not fetch address data');
        }
      } catch (err) {
        setError('Failed to fetch address data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAddressData();
  }, [chain, addr]);

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
        <p>Fetching Address Details...</p>
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
            <span className={styles.navLinkActive} onClick={() => router.push(`/explorer/${chainId}`)}>Home</span>
            <span className={styles.navLink} onClick={() => alert('Blockchain section coming soon!')}>Blockchain</span>
            <span className={styles.navLink} onClick={() => alert('Tokens section coming soon!')}>Tokens</span>
            <span className={styles.navLink} onClick={() => alert('Misc section coming soon!')}>Misc</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.contentSection} style={{ marginTop: '2rem', maxWidth: '1000px' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ background: '#f1f5f9', padding: '0.5rem', borderRadius: '50%' }}>👤</div> Address
        </h1>
        <div style={{ marginBottom: '2rem', wordBreak: 'break-all', fontSize: '1.1rem', fontWeight: '500', color: '#0f172a' }}>
          {addr}
        </div>
        
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Overview</h2>
          </div>
          <div className={styles.cardBody} style={{ padding: '1rem' }}>
            
            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Balance:</div>
              <div style={{ width: '75%', fontSize: '1.1rem', fontWeight: '600' }}>
                {balance ? (parseInt(balance, 16) / 1e18).toFixed(6).replace(/\.?0+$/, '') : '0'} {chain.token?.symbol}
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Sent Transactions:</div>
              <div style={{ width: '75%' }}>
                {txCount ? parseInt(txCount, 16) : 0}
              </div>
            </div>

          </div>
        </div>

        <div style={{ marginTop: '2rem', padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
          <p>
            ℹ️ Full transaction history for specific addresses requires an Indexing service (like TheGraph or Blockscout) which is currently not enabled for this preview.
          </p>
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
