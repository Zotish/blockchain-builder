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

    // Proxy the RPC request to avoid Mixed Content (HTTPS -> HTTP) blocks
    const rpcUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/rpc/${chain._id}`
      : `${window.location.origin}/api/rpc/${chain._id}`;

    const normalizeBlock = (b, type) => {
      if (type === 'substrate') {
        return {
          number: parseInt(b.block.header.number, 16) || b.block.header.number,
          hash: b.block.header.parentHash, // Substrate header doesn't easily show own hash in some RPCs, using parent as proxy or placeholder
          timestamp: Date.now(), // Substrate RPCs often require a separate call for timestamp, using current as fallback
          miner: 'Validator',
          transactions: b.block.extrinsics || [],
          gasUsed: '0x0', gasLimit: '0x1'
        };
      }
      if (type === 'cosmos') {
        return {
          number: parseInt(b.block.header.height),
          hash: b.block_id.hash,
          timestamp: b.block.header.time,
          miner: b.block.header.proposer_address,
          transactions: b.block.data.txs || [],
          gasUsed: '0x0', gasLimit: '0x1'
        };
      }
      if (type === 'solana') {
        return {
          number: b.slot || b.number,
          hash: b.blockhash || '...',
          timestamp: (b.blockTime * 1000) || Date.now(),
          miner: 'Leader',
          transactions: b.transactions || [],
          gasUsed: '0x0', gasLimit: '0x1'
        };
      }
      return b; // EVM is already normalized
    };

    const fetchLatestData = async () => {
      try {
        let latestNum = 0;
        let chainType = chain.type || 'evm';

        if (chainType === 'substrate') {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'chain_getHeader', params: [], id: 1 })
          });
          const data = await res.json();
          if (data.result) latestNum = parseInt(data.result.number, 16);
        } else if (chainType === 'solana') {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'getSlot', params: [], id: 1 })
          });
          const data = await res.json();
          if (data.result) latestNum = data.result;
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

        if (!latestNum || !mounted) return;
        setStats(s => ({ ...s, latestBlock: latestNum, blockHeight: latestNum }));

        // Fetch recent blocks (Top 6)
        const blockPromises = [];
        const count = 6;

        if (chainType === 'evm') {
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
        } else if (chainType === 'substrate') {
          // Substrate requires getting hash first, then block
          // For simplicity in polling, we fetch the last few headers if possible or just the latest
          blockPromises.push(
            fetch(rpcUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', method: 'chain_getBlock', params: [], id: 1 })
            }).then(r => r.json()).then(d => d.result)
          );
        }

        const results = await Promise.all(blockPromises);
        const validBlocks = results.filter(Boolean).map(b => normalizeBlock(b, chainType));
        
        if (mounted && validBlocks.length > 0) {
          setBlocks(validBlocks);
          
          // Extract transactions
          const allTxs = [];
          validBlocks.forEach(b => {
            if (b.transactions && b.transactions.length > 0) {
              const txs = b.transactions.map(tx => ({
                hash: tx.hash || tx.transactionIndex || Math.random().toString(36).slice(2),
                from: tx.from || 'Unknown',
                to: tx.to || 'Unknown',
                value: tx.value || '0x0',
                timestamp: b.timestamp,
                blockNumber: b.number
              }));
              allTxs.push(...txs);
            }
          });
          setTransactions(allTxs.slice(0, 6));
        } else if (mounted) {
          updateMockBlocks(latestNum);
        }

        // Fetch Gas Price (EVM Only)
        if (chainType === 'evm' && mounted) {
          const gasRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 })
          });
          const gasData = await gasRes.json();
          if (gasData.result) {
            const gwei = (parseInt(gasData.result, 16) / 1e9).toFixed(1);
            setStats(s => ({ ...s, gasPrice: gwei + ' Gwei' }));
          }
        }
      } catch (err) {
        console.warn('Explorer fetch failed:', err.message);
      }
    };

    const updateMockBlocks = (blockNum) => {
      setBlocks(prev => {
        if (prev && prev.length > 0) return prev;
        return Array.from({ length: 6 }, (_, i) => ({
          number: blockNum - i,
          hash: '0x' + Math.random().toString(16).slice(2, 66),
          timestamp: Date.now() - (i * 6000),
          txCount: 0
        })).filter(b => b.number >= 0);
      });
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
    const query = searchQuery.trim();
    if (!query) return;
    
    // Determine type based on query
    if (/^0x[0-9a-fA-F]{64}$/.test(query)) {
      // 66 chars: Tx Hash or Block Hash. Defaulting to tx
      router.push(`/explorer/${chainId}/tx/${query}`);
    } else if (/^0x[0-9a-fA-F]{40}$/.test(query)) {
      // 42 chars: Address
      router.push(`/explorer/${chainId}/address/${query}`);
    } else if (/^\d+$/.test(query)) {
      // Numbers: Block Number
      router.push(`/explorer/${chainId}/block/${query}`);
    } else {
      alert('Invalid search query. Please enter a valid Address, Tx Hash, or Block Number.');
    }
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
            <span className={styles.navLinkActive} onClick={() => router.push(`/explorer/${chainId}`)}>Home</span>
            <span className={styles.navLink} onClick={() => router.push(`/explorer/${chainId}/bridge`)}>Bridge</span>
            <span className={styles.navLink} onClick={() => router.push(`/explorer/${chainId}/staking`)}>Staking</span>
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
      
      {/* Core Infrastructure Contracts (NEW) */}
      {chain.contracts && (
        <section className={styles.contentSection} style={{ marginTop: '1rem', marginBottom: '-1rem' }}>
          <div className={styles.contentContainer}>
            <div className={styles.card} style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', border: '1px solid #bfdbfe' }}>
              <div className={styles.cardHeader} style={{ borderBottom: '1px solid #bfdbfe', padding: '1rem 1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', color: '#1e40af', margin: 0 }}>⚡ Core Infrastructure Contracts</h2>
              </div>
              <div className={styles.cardBody} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', padding: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Staking Contract</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500', fontFamily: 'monospace', color: '#0f172a', wordBreak: 'break-all' }}>{chain.contracts.staking}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Bridge Contract (L2)</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '500', fontFamily: 'monospace', color: '#0f172a', wordBreak: 'break-all' }}>{chain.contracts.bridge}</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
                        <div className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/block/${parseInt(block.number, 16)}`)}>{parseInt(block.number, 16)}</div>
                        <div className={styles.subText}>{timeAgo(block.timestamp)}</div>
                      </div>
                    </div>
                    <div className={styles.rowMiddle}>
                      <div>Validated By <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${block.miner}`)}>{truncateAddr(block.miner)}</span></div>
                      <div className={styles.subText}>
                        <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/block/${parseInt(block.number, 16)}`)}>{block.transactions?.length || 0} txns</span> in {chain.config?.blockTime} secs
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
                        <div className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/tx/${tx.hash}`)}>{truncateHash(tx.hash)}</div>
                        <div className={styles.subText}>{timeAgo(tx.timestamp)}</div>
                      </div>
                    </div>
                    <div className={styles.rowMiddle}>
                      <div>From <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${tx.from}`)}>{truncateAddr(tx.from)}</span></div>
                      <div>To {tx.to ? <span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${tx.to}`)}>{truncateAddr(tx.to)}</span> : 'Contract Creation'}</div>
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
