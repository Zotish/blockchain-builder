'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import styles from './public-explorer.module.css';

export default function PublicExplorerPage() {
  const params = useParams();
  const router = useRouter();
  const { chainId } = params;

  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [blocks, setBlocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    blockHeight: 0,
    gasPrice: '—',
    tps: 0,
    marketCap: '—'
  });

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
      } finally {
        setLoading(false);
      }
    }
    if (chainId) loadChain();
  }, [chainId]);

  // Fetch Blocks and Txs from RPC
  useEffect(() => {
    if (!chain || chain.status !== 'deployed' || !chain.endpoints?.rpc) return;

    let mounted = true;
    const rpcUrl = chain.endpoints.rpc;

    const fetchLatestData = async () => {
      try {
        // Fetch latest block number
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
        });
        const data = await res.json();
        if (!data.result) return;
        
        const latestNum = parseInt(data.result, 16);
        setStats(s => ({ ...s, blockHeight: latestNum }));

        // Fetch last 6 blocks
        const blockPromises = [];
        for (let i = latestNum; i > Math.max(-1, latestNum - 6); i--) {
          blockPromises.push(
            fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: ['0x' + i.toString(16), true], id: i })
            }).then(r => r.json())
          );
        }

        const blockResults = await Promise.all(blockPromises);
        const newBlocks = blockResults.map(b => b.result).filter(Boolean);
        
        if (mounted) {
          setBlocks(newBlocks);
          // Extract txs from these blocks
          const allTxs = [];
          newBlocks.forEach(b => {
            if (b.transactions && b.transactions.length > 0) {
              // Add block timestamp to txs for UI
              const blockTxs = b.transactions.map(tx => ({...tx, timestamp: b.timestamp}));
              allTxs.push(...blockTxs);
            }
          });
          // Sort by newest and take top 6
          allTxs.sort((a, b) => parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16));
          setTransactions(allTxs.slice(0, 6));
        }

        // Fetch Gas Price
        const gasRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 })
        });
        const gasData = await gasRes.json();
        if (gasData.result && mounted) {
          const gwei = (parseInt(gasData.result, 16) / 1e9).toFixed(1);
          setStats(s => ({ ...s, gasPrice: gwei + ' Gwei' }));
        }

      } catch (err) {
        console.warn('Explorer fetch failed:', err.message);
      }
    };

    fetchLatestData();
    const interval = setInterval(fetchLatestData, (chain.config?.blockTime || 5) * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [chain]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    alert(`Search for ${searchQuery} not fully implemented yet in this preview.`);
  };

  const truncateHash = (hash) => hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : '';
  const truncateAddr = (addr) => addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : '';
  
  const timeAgo = (hexTs) => {
    if (!hexTs) return '';
    const ts = parseInt(hexTs, 16) * 1000;
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s} secs ago`;
    if (s < 3600) return `${Math.floor(s/60)} mins ago`;
    return `${Math.floor(s/3600)} hrs ago`;
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading Network Data...</p>
      </div>
    );
  }

  if (error || !chain) {
    return (
      <div className={styles.errorContainer}>
        <h2>Network Not Found</h2>
        <p>{error}</p>
        <button onClick={() => router.push('/')} className="btn btn-primary mt-4">Go Home</button>
      </div>
    );
  }

  const isLive = chain.status === 'deployed';

  return (
    <div className={styles.explorerPage}>
      {/* Top Navbar Etherscan Style */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <div className={styles.brand} onClick={() => router.push('/')}>
            <div className={styles.logoIcon}>⛓️</div>
            <div className={styles.brandName}>
              {chain.name} <span className={styles.scanText}>Scan</span>
            </div>
          </div>
          <div className={styles.navLinks}>
            <span className={styles.navLinkActive}>Home</span>
            <span className={styles.navLink}>Blockchain</span>
            <span className={styles.navLink}>Tokens</span>
            <span className={styles.navLink}>Misc</span>
          </div>
        </div>
      </header>

      {/* Hero Search Section */}
      <section className={styles.heroSection}>
        <div className={styles.heroContainer}>
          <h1 className={styles.heroTitle}>
            The {chain.name} Explorer
          </h1>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <div className={styles.searchBox}>
              <select className={styles.searchFilter}>
                <option>All Filters</option>
                <option>Addresses</option>
                <option>Tokens</option>
                <option>Name Tags</option>
                <option>Labels</option>
                <option>Websites</option>
              </select>
              <input 
                type="text" 
                placeholder="Search by Address / Txn Hash / Block / Token"
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className={styles.searchBtn}>🔍</button>
            </div>
          </form>
          {!isLive && (
            <div className={styles.offlineNotice}>
              ⚠️ This network is currently offline or not deployed.
            </div>
          )}
        </div>
      </section>

      {/* Stats Cards */}
      <section className={styles.statsSection}>
        <div className={styles.statsContainer}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>💰</div>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>{chain.token?.symbol || 'TOKEN'} PRICE</div>
              <div className={styles.statValue}>$0.00</div>
            </div>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🌐</div>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>MARKET CAP</div>
              <div className={styles.statValue}>$0.00</div>
            </div>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📦</div>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>LATEST BLOCK</div>
              <div className={styles.statValue}>{stats.blockHeight}</div>
              <div className={styles.statSubText}>{chain.config?.blockTime}s Block Time</div>
            </div>
          </div>
          <div className={styles.statDivider}></div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>⛽</div>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>GAS PRICE</div>
              <div className={styles.statValue}>{stats.gasPrice}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Blocks & Txs */}
      <section className={styles.contentSection}>
        <div className={styles.contentContainer}>
          
          {/* Latest Blocks */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Latest Blocks</h2>
            </div>
            <div className={styles.cardBody}>
              {blocks.length === 0 ? (
                <div className={styles.emptyState}>No blocks available</div>
              ) : (
                blocks.map(block => (
                  <div className={styles.rowItem} key={block.hash}>
                    <div className={styles.rowLeft}>
                      <div className={styles.iconBox}>Bk</div>
                      <div>
                        <div className={styles.primaryLink}>{parseInt(block.number, 16)}</div>
                        <div className={styles.subText}>{timeAgo(block.timestamp)}</div>
                      </div>
                    </div>
                    <div className={styles.rowMiddle}>
                      <div>Validated By <span className={styles.primaryLink}>{truncateAddr(block.miner)}</span></div>
                      <div className={styles.subText}>
                        <span className={styles.primaryLink}>{block.transactions?.length || 0} txns</span> in {chain.config?.blockTime} secs
                      </div>
                    </div>
                    <div className={styles.rowRight}>
                      <div className={styles.badge}>{Math.round(parseInt(block.gasUsed, 16) / parseInt(block.gasLimit, 16) * 100)}% Gas Used</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.cardFooter}>
              <button className={styles.viewAllBtn}>VIEW ALL BLOCKS</button>
            </div>
          </div>

          {/* Latest Transactions */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>Latest Transactions</h2>
            </div>
            <div className={styles.cardBody}>
              {transactions.length === 0 ? (
                <div className={styles.emptyState}>No recent transactions</div>
              ) : (
                transactions.map(tx => (
                  <div className={styles.rowItem} key={tx.hash}>
                    <div className={styles.rowLeft}>
                      <div className={styles.iconBoxTx}>Tx</div>
                      <div>
                        <div className={styles.primaryLink}>{truncateHash(tx.hash)}</div>
                        <div className={styles.subText}>{timeAgo(tx.timestamp)}</div>
                      </div>
                    </div>
                    <div className={styles.rowMiddle}>
                      <div>From <span className={styles.primaryLink}>{truncateAddr(tx.from)}</span></div>
                      <div>To <span className={styles.primaryLink}>{truncateAddr(tx.to)}</span></div>
                    </div>
                    <div className={styles.rowRight}>
                      <div className={styles.badgeSuccess}>
                        {tx.value === '0x0' ? '0' : (parseInt(tx.value, 16) / 1e18).toFixed(4)} {chain.token?.symbol}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.cardFooter}>
              <button className={styles.viewAllBtn}>VIEW ALL TRANSACTIONS</button>
            </div>
          </div>

        </div>
      </section>
      
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          Powered by ChainForge Infrastructure
        </div>
      </footer>
    </div>
  );
}
