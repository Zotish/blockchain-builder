'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { useChainStats } from '../../../lib/socket';
import styles from './chainDetail.module.css';

const CHAIN_ICONS = {
  evm: '⟠', substrate: '◆', cosmos: '⚛', hyperledger: '⬡',
  solana: '◎', dag: '▽', custom: '⚙',
};

export default function ChainDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [chain, setChain] = useState(null);
  const [adapterInfo, setAdapterInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState('');
  const [faucetAddr, setFaucetAddr] = useState('');
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetResult, setFaucetResult] = useState(null);
  const [faucetError, setFaucetError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [stats, setStats] = useState(null);
  useChainStats(id, useCallback((s) => setStats(s), []));

  const fetchChain = useCallback(async () => {
    try {
      const [chainRes, adapterRes] = await Promise.all([
        api.getChain(id),
        api.getChainAdapter(id).catch(() => null),
      ]);
      if (chainRes.success) setChain(chainRes.data.chain || chainRes.data);
      else setError(chainRes.error);
      if (adapterRes?.success) setAdapterInfo(adapterRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchChain(); }, [fetchChain]);

  const copyToClipboard = async (text, label) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const addToWallet = async () => {
    if (isEVM) {
      if (!window.ethereum) return alert('Please install MetaMask!');
      
      // Use the secure API RPC proxy (works in Netlify through rewrites to Railway)
      const rpcUrl = process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL}/rpc/${chain._id}`
        : `${window.location.origin}/api/rpc/${chain._id}`;
      
      const chainIdNum = chain.config?.chainId || 1337;
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x' + Number(chainIdNum).toString(16),
            chainName: chain.name,
            nativeCurrency: {
              name: chain.token?.name || chain.name + ' Token',
              symbol: chain.token?.symbol || chain.config?.symbol || 'TOKEN',
              decimals: chain.token?.decimals || 18,
            },
            rpcUrls: [rpcUrl],
          }],
        });
        alert('✅ Network added to MetaMask!');
      } catch (err) { alert('MetaMask error: ' + err.message); }
    } else {
      window.open(adapterInfo?.walletUrl || '#', '_blank');
    }
  };

  const handleFaucet = async () => {
    if (!faucetAddr) return setFaucetError('Enter a wallet address');
    setFaucetLoading(true);
    setFaucetError('');
    setFaucetResult(null);
    try {
      const res = await api.requestFaucet(id, faucetAddr);
      if (res.success) setFaucetResult(res.data);
      else setFaucetError(res.error);
    } catch (err) {
      setFaucetError(err.message);
    } finally {
      setFaucetLoading(false);
    }
  };

  if (loading) return <div className={styles.loadingScreen}><div className={styles.spinner} /><p>Loading chain details...</p></div>;
  if (error) return <div className={styles.errorScreen}><h2>❌ Error</h2><p>{error}</p><button onClick={() => router.push('/dashboard')}>← Dashboard</button></div>;
  if (!chain) return null;

  const isDeployed = chain.status === 'deployed';
  const isEVM = ['evm', 'hyperledger', 'custom'].includes(chain.type);
  const liveStats = stats || chain.stats || {};
  const walletName = adapterInfo?.walletName || (isEVM ? 'MetaMask' : 'Wallet');
  const walletIcon = adapterInfo?.walletIcon || (isEVM ? '🦊' : '👛');

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>← Dashboard</button>
        <div className={styles.headerInfo}>
          <span className={styles.chainIcon}>{CHAIN_ICONS[chain.type] || '⛓'}</span>
          <div>
            <h1 className={styles.chainName}>{chain.name}</h1>
            <div className={styles.badges}>
              <span className={`${styles.badge} ${styles[chain.type]}`}>{chain.type.toUpperCase()}</span>
              <span className={`${styles.badge} ${isDeployed ? styles.live : styles.offline}`}>
                {isDeployed ? '● Live' : '○ ' + chain.status}
              </span>
              {chain.network && <span className={`${styles.badge} ${styles.network}`}>{chain.network}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Live Stats Bar */}
      {isDeployed && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Block Height</span>
            <span className={styles.statValue}>{(liveStats.blockHeight || 0).toLocaleString()}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Transactions</span>
            <span className={styles.statValue}>{(liveStats.txCount || 0).toLocaleString()}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Peers</span>
            <span className={styles.statValue}>{liveStats.peers || 0}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>{isEVM ? 'Gas Price' : 'Status'}</span>
            <span className={styles.statValue}>{isEVM ? (liveStats.gasPrice ? (parseInt(liveStats.gasPrice) / 1e9).toFixed(1) + ' Gwei' : '—') : (isDeployed ? '● Online' : '○ Offline')}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {['overview', 'faucet', 'explorer', 'config'].map(tab => (
          <button key={tab} className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'overview' && '📡'} {tab === 'faucet' && '💧'} {tab === 'explorer' && '🔍'} {tab === 'config' && '⚙'}
            {' '}{tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.content}>

        {/* ─── OVERVIEW TAB ────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            {/* Endpoints */}
            {isDeployed && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>🔌 Connection Endpoints</h3>
                <div className={styles.endpoints}>
                  {chain.endpoints?.rpc && (
                    <div className={styles.endpointRow}>
                      <span className={styles.endpointLabel}>RPC URL</span>
                      <div className={styles.endpointValue}>
                        <code>{chain.endpoints.rpc}</code>
                        <button className={styles.copyBtn} onClick={() => copyToClipboard(chain.endpoints.rpc, 'rpc')}>
                          {copied === 'rpc' ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                  )}
                  {chain.endpoints?.ws && (
                    <div className={styles.endpointRow}>
                      <span className={styles.endpointLabel}>WebSocket</span>
                      <div className={styles.endpointValue}>
                        <code>{chain.endpoints.ws}</code>
                        <button className={styles.copyBtn} onClick={() => copyToClipboard(chain.endpoints.ws, 'ws')}>
                          {copied === 'ws' ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={styles.endpointRow}>
                    <span className={styles.endpointLabel}>Chain ID</span>
                    <div className={styles.endpointValue}>
                      <code>{chain.config?.chainId}</code>
                      <button className={styles.copyBtn} onClick={() => copyToClipboard(String(chain.config?.chainId), 'chainId')}>
                        {copied === 'chainId' ? '✓' : '📋'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.endpointRow}>
                    <span className={styles.endpointLabel}>Public Explorer</span>
                    <div className={styles.endpointValue}>
                      <code>{typeof window !== 'undefined' ? `${window.location.origin}/explorer/${chain._id}` : `/explorer/${chain._id}`}</code>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '0 8px', minHeight: 'auto', height: '24px' }} onClick={() => window.open(`/explorer/${chain._id}`, '_blank')}>
                        ↗️
                      </button>
                    </div>
                  </div>
                </div>

                {/* Wallet Connect Button — works for ALL chain types */}
                <button className={styles.metamaskBtn} onClick={addToWallet}>
                  <span className={styles.metamaskIcon}>{walletIcon}</span>
                  {isEVM ? `Add to ${walletName} — One Click` : `Get ${walletName} Wallet`}
                </button>

                {/* Connect code for non-EVM chains */}
                {!isEVM && adapterInfo?.connectCode && (
                  <div style={{ marginTop: 16 }}>
                    <p className={styles.cardDesc}>How to connect to this {chain.type} chain:</p>
                    <pre className={styles.codeBlock}>{adapterInfo.connectCode}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Chain Config */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>⚙ Chain Configuration</h3>
              <div className={styles.configGrid}>
                <div className={styles.configItem}><span>Consensus</span><strong>{chain.config?.consensus?.toUpperCase() || '—'}</strong></div>
                <div className={styles.configItem}><span>Block Time</span><strong>{chain.config?.blockTime || '—'}s</strong></div>
                <div className={styles.configItem}><span>Network</span><strong>{chain.config?.networkType || '—'}</strong></div>
                <div className={styles.configItem}><span>Gas Limit</span><strong>{chain.config?.blockGasLimit || '—'}</strong></div>
              </div>
            </div>

            {/* Token Info */}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>🪙 Token</h3>
              <div className={styles.configGrid}>
                <div className={styles.configItem}><span>Name</span><strong>{chain.token?.name || '—'}</strong></div>
                <div className={styles.configItem}><span>Symbol</span><strong>{chain.token?.symbol || chain.config?.symbol || '—'}</strong></div>
                <div className={styles.configItem}><span>Decimals</span><strong>{chain.token?.decimals ?? 18}</strong></div>
                <div className={styles.configItem}><span>Total Supply</span><strong>{chain.token?.totalSupply || '—'}</strong></div>
              </div>
            </div>

            {/* Quick Actions */}
            {!isDeployed && (
              <div className={styles.card}>
                <h3 className={styles.cardTitle}>🚀 Deploy Your Chain</h3>
                <p className={styles.cardDesc}>This chain hasn't been deployed yet. Deploy to testnet to get live endpoints.</p>
                <button className={styles.primaryBtn} onClick={() => router.push('/dashboard')}>Go to Dashboard to Deploy →</button>
              </div>
            )}
          </>
        )}

        {/* ─── FAUCET TAB ──────────────────────────────── */}
        {activeTab === 'faucet' && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>💧 Testnet Faucet</h3>
            {!isDeployed ? (
              <p className={styles.cardDesc}>Deploy this chain to testnet first to use the faucet.</p>
            ) : chain.network === 'mainnet' ? (
              <p className={styles.cardDesc}>Faucet is only available for testnet chains.</p>
            ) : (
              <>
                <p className={styles.cardDesc}>
                  Get free test tokens for development. Limited to 1 request per hour per chain.
                </p>
                <p className={styles.cardDesc} style={{ fontSize: 12, color: '#64748b' }}>
                  {walletIcon} Wallet: <strong>{walletName}</strong> | Format: {adapterInfo?.addressFormat || 'Any'}
                </p>
                <div className={styles.faucetForm}>
                  <input
                    type="text"
                    className={styles.faucetInput}
                    placeholder={adapterInfo?.addressPlaceholder || '0x... your wallet address'}
                    value={faucetAddr}
                    onChange={e => setFaucetAddr(e.target.value)}
                  />
                  <button className={styles.faucetBtn} onClick={handleFaucet} disabled={faucetLoading}>
                    {faucetLoading ? 'Sending...' : `💧 Request ${chain.token?.symbol || 'Tokens'}`}
                  </button>
                </div>
                {faucetError && <div className={styles.faucetError}>❌ {faucetError}</div>}
                {faucetResult && (
                  <div className={styles.faucetSuccess}>
                    <p>✅ <strong>{faucetResult.amount} {faucetResult.symbol}</strong> sent!</p>
                    {faucetResult.txHash && (
                      <div className={styles.txHash}>
                        <span>TX: </span>
                        <code>{faucetResult.txHash.slice(0, 20)}...{faucetResult.txHash.slice(-8)}</code>
                        <button className={styles.copyBtn} onClick={() => copyToClipboard(faucetResult.txHash, 'tx')}>
                          {copied === 'tx' ? '✓' : '📋'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ─── EXPLORER TAB ────────────────────────────── */}
        {activeTab === 'explorer' && (
          <div className={styles.card} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>🌐 Public Block Explorer</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: '2rem' }}>
              We've upgraded to a standalone, full-screen public explorer (Etherscan-style) for your blockchain. 
              Share this link with your community.
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => window.open(`/explorer/${chain._id}`, '_blank')}
              style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
            >
              Open {chain.name}Scan ↗️
            </button>
          </div>
        )}

        {/* ─── CONFIG TAB ──────────────────────────────── */}
        {activeTab === 'config' && (
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>📄 Full Configuration (JSON)</h3>
            <pre className={styles.codeBlock}>
              {JSON.stringify({
                name: chain.name,
                type: chain.type,
                chainId: chain.config?.chainId,
                consensus: chain.config?.consensus,
                blockTime: chain.config?.blockTime,
                blockGasLimit: chain.config?.blockGasLimit,
                networkType: chain.config?.networkType,
                token: chain.token,
                governance: chain.governance,
                endpoints: chain.endpoints,
              }, null, 2)}
            </pre>
            <button className={styles.downloadBtn} onClick={() => {
              const blob = new Blob([JSON.stringify(chain, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `${chain.name}-config.json`; a.click();
              URL.revokeObjectURL(url);
            }}>
              📥 Download Full Config
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Live Explorer Sub-Component ─────────────────────── */
function LiveExplorer({ chain, stats }) {
  const [blocks, setBlocks] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);

  const isDeployed = chain.status === 'deployed';
  const rpcUrl = chain.endpoints?.rpc;

  const fetchBlocks = useCallback(async () => {
    if (!rpcUrl) return;
    setLoadingBlocks(true);
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      });
      const data = await res.json();
      const latest = parseInt(data.result, 16);

      const blockPromises = [];
      for (let i = latest; i > Math.max(latest - 10, -1); i--) {
        blockPromises.push(
          fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: ['0x' + i.toString(16), true], id: i }),
          }).then(r => r.json())
        );
      }

      const blockResults = await Promise.all(blockPromises);
      const parsedBlocks = blockResults
        .filter(b => b.result)
        .map(b => ({
          number: parseInt(b.result.number, 16),
          hash: b.result.hash,
          timestamp: new Date(parseInt(b.result.timestamp, 16) * 1000),
          txCount: b.result.transactions?.length || 0,
          gasUsed: parseInt(b.result.gasUsed, 16),
          miner: b.result.miner,
          transactions: b.result.transactions || [],
        }));

      setBlocks(parsedBlocks);

      const allTxs = parsedBlocks.flatMap(b =>
        b.transactions.map(tx => ({
          hash: typeof tx === 'string' ? tx : tx.hash,
          from: typeof tx === 'string' ? '—' : tx.from,
          to: typeof tx === 'string' ? '—' : (tx.to || 'Contract Creation'),
          value: typeof tx === 'string' ? '0' : (parseInt(tx.value, 16) / 1e18).toFixed(4),
          blockNumber: b.number,
        }))
      );
      setTxs(allTxs.slice(0, 20));
    } catch (err) {
      console.warn('Explorer fetch error:', err.message);
      // Generate demo blocks if RPC unavailable
      const demoBlocks = Array.from({ length: 5 }, (_, i) => ({
        number: (stats?.blockHeight || 100) - i,
        hash: '0x' + Math.random().toString(16).slice(2).padEnd(64, '0'),
        timestamp: new Date(Date.now() - i * (chain.config?.blockTime || 5) * 1000),
        txCount: Math.floor(Math.random() * 5),
        gasUsed: Math.floor(Math.random() * 3000000),
        miner: '0x' + Math.random().toString(16).slice(2, 42),
      }));
      setBlocks(demoBlocks);
    } finally {
      setLoadingBlocks(false);
    }
  }, [rpcUrl, chain.config?.blockTime, stats?.blockHeight]);

  useEffect(() => {
    if (isDeployed) fetchBlocks();
    const interval = setInterval(fetchBlocks, 15000);
    return () => clearInterval(interval);
  }, [fetchBlocks, isDeployed]);

  if (!isDeployed) {
    return <div className={styles.card}><p className={styles.cardDesc}>Deploy this chain to see live blocks.</p></div>;
  }

  return (
    <>
      {/* Blocks */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>⛏ Latest Blocks {loadingBlocks && <span className={styles.refreshDot} />}</h3>
        <div className={styles.explorerTable}>
          <div className={styles.tableHeader}>
            <span>Block</span><span>Time</span><span>TXs</span><span>Gas Used</span><span>Hash</span>
          </div>
          {blocks.map(b => (
            <div key={b.number} className={styles.tableRow}>
              <span className={styles.blockNum}>#{b.number}</span>
              <span>{b.timestamp.toLocaleTimeString()}</span>
              <span>{b.txCount}</span>
              <span>{b.gasUsed.toLocaleString()}</span>
              <span className={styles.hashCell}>{b.hash?.slice(0, 14)}...</span>
            </div>
          ))}
          {blocks.length === 0 && <p className={styles.emptyMsg}>No blocks yet. Waiting for first block...</p>}
        </div>
      </div>

      {/* Transactions */}
      {txs.length > 0 && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>📝 Recent Transactions</h3>
          <div className={styles.explorerTable}>
            <div className={styles.tableHeader}>
              <span>TX Hash</span><span>From</span><span>To</span><span>Value</span><span>Block</span>
            </div>
            {txs.map((tx, i) => (
              <div key={i} className={styles.tableRow}>
                <span className={styles.hashCell}>{tx.hash?.slice(0, 14)}...</span>
                <span className={styles.hashCell}>{tx.from?.slice(0, 10)}...</span>
                <span className={styles.hashCell}>{typeof tx.to === 'string' ? tx.to.slice(0, 10) + '...' : tx.to}</span>
                <span>{tx.value} {chain.config?.symbol || 'ETH'}</span>
                <span>#{tx.blockNumber}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
