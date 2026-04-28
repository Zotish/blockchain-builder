'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../../lib/api';
import styles from '../../public-explorer.module.css';

export default function BlockDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { chainId, number } = params;

  const [chain, setChain] = useState(null);
  const [block, setBlock] = useState(null);
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

  // Fetch Block Data
  useEffect(() => {
    if (!chain || chain.status !== 'deployed' || !chain.endpoints?.rpc) {
      if (chain && chain.status !== 'deployed') setLoading(false);
      return;
    }

    const fetchBlockData = async () => {
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/rpc/${chain._id}`
          : `${window.location.origin}/api/rpc/${chain._id}`;

        const hexNum = '0x' + parseInt(number, 10).toString(16);

        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: [hexNum, true], id: 1 })
        });
        const data = await res.json();

        if (data.result) {
          setBlock(data.result);
        } else {
          setError('Block not found');
        }
      } catch (err) {
        setError('Failed to fetch block data: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockData();
  }, [chain, number]);

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

  const truncateHash = (hash) => hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : '';
  const truncateAddr = (addr) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '';

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Fetching Block Details...</p>
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
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>
          Block <span style={{ color: '#64748b' }}>#{number}</span>
        </h1>
        
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Overview</h2>
          </div>
          <div className={styles.cardBody} style={{ padding: '1rem' }}>
            
            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Block Height:</div>
              <div style={{ width: '75%' }}>{number}</div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Timestamp:</div>
              <div style={{ width: '75%' }}>
                {block?.timestamp ? new Date(parseInt(block.timestamp, 16) * 1000).toLocaleString() : '—'}
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Transactions:</div>
              <div style={{ width: '75%' }}>
                {block?.transactions?.length || 0} transactions
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Mined by:</div>
              <div style={{ width: '75%' }}>
                <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${block?.miner}`)}>
                  {block?.miner}
                </span>
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Gas Used:</div>
              <div style={{ width: '75%' }}>
                {block?.gasUsed ? parseInt(block.gasUsed, 16).toLocaleString() : '—'} 
                <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '8px' }}>
                  ({Math.round((parseInt(block?.gasUsed || 0, 16) / parseInt(block?.gasLimit || 1, 16)) * 100)}%)
                </span>
              </div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Gas Limit:</div>
              <div style={{ width: '75%' }}>
                {block?.gasLimit ? parseInt(block.gasLimit, 16).toLocaleString() : '—'}
              </div>
            </div>
            
            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Hash:</div>
              <div style={{ width: '75%', wordBreak: 'break-all' }}>{block?.hash}</div>
            </div>

            <div className={styles.rowItem}>
              <div style={{ width: '25%', color: '#64748b', fontWeight: '500' }}>Parent Hash:</div>
              <div style={{ width: '75%', wordBreak: 'break-all', color: '#3b82f6', cursor: 'pointer' }} onClick={() => router.push(`/explorer/${chainId}/block/${parseInt(number, 10) - 1}`)}>
                {block?.parentHash}
              </div>
            </div>

          </div>
        </div>

        {/* Transactions Table */}
        {block?.transactions?.length > 0 && (
          <div className={styles.card} style={{ marginTop: '2rem' }}>
            <div className={styles.cardHeader}>
              <h2>Transactions in Block</h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.tableWrapper} style={{ overflowX: 'auto', padding: '1rem' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '0.5rem' }}>Txn Hash</th>
                      <th style={{ padding: '0.5rem' }}>From</th>
                      <th style={{ padding: '0.5rem' }}>To</th>
                      <th style={{ padding: '0.5rem' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {block.transactions.map((tx) => (
                      <tr key={tx.hash} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/tx/${tx.hash}`)}>
                            {truncateHash(tx.hash)}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${tx.from}`)}>
                            {truncateAddr(tx.from)}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          {tx.to ? (
                            <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${tx.to}`)}>
                              {truncateAddr(tx.to)}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b' }}>Contract Creation</span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span className={styles.badgeSuccess}>
                            {(parseInt(tx.value, 16) / 1e18).toFixed(4).replace(/\.?0+$/, '') || '0'} {chain.token?.symbol}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <footer className={styles.footer} style={{ marginTop: 'auto' }}>
        <div className={styles.footerInner}>
          Powered by ChainForge Infrastructure
        </div>
      </footer>
    </div>
  );
}
