'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../../lib/api';
import styles from '../../public-explorer.module.css';

export default function StakingPage() {
  const params = useParams();
  const router = useRouter();
  const { chainId } = params;

  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('stake'); // stake, unstake

  // Mock Staking Stats
  const mockStats = {
    totalStaked: '1,250,000',
    apy: '12.5%',
    validators: 5,
    myStaked: wallet ? '5,000' : '0.00',
    rewards: wallet ? '12.45' : '0.00'
  };

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

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        setWallet(accounts[0]);
      } catch (err) {
        alert('Wallet connection failed!');
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  const handleAction = async () => {
    if (!wallet) return alert('Please connect your wallet first.');
    if (!amount || parseFloat(amount) <= 0) return alert('Enter a valid amount.');
    
    setProcessing(true);
    
    // Simulating TX
    setTimeout(() => {
      setProcessing(false);
      setAmount('');
      alert(`🎉 Successfully ${activeTab === 'stake' ? 'staked' : 'unstaked'} ${amount} ${chain.token?.symbol}!\n\n(Note: This is a simulation interface.)`);
    }, 2000);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading Staking Dashboard...</p>
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
            <span className={styles.navLinkActive} onClick={() => router.push(`/explorer/${chainId}/staking`)}>Staking</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.contentSection} style={{ marginTop: '2rem', maxWidth: '1000px', margin: '2rem auto' }}>
        <h1 style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '0.5rem' }}>Staking Dashboard</h1>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem' }}>Stake your {chain.token?.symbol} to secure the network and earn rewards.</p>
        
        {/* Top Global Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Total Staked</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#0f172a' }}>{mockStats.totalStaked} <span style={{ fontSize: '1rem', color: '#64748b' }}>{chain.token?.symbol}</span></div>
          </div>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Current APY</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#16a34a' }}>{mockStats.apy}</div>
          </div>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
            <div style={{ color: '#64748b', fontSize: '0.9rem', fontWeight: '600', marginBottom: '0.5rem' }}>Active Validators</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#0f172a' }}>{mockStats.validators}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          
          {/* Left: User Stats */}
          <div style={{ background: '#f8fafc', padding: '2rem', borderRadius: '16px', border: '1px solid #cbd5e1' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#0f172a' }}>My Position</h2>
            {!wallet ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Connect your wallet to view your staking details.</p>
                <button onClick={connectWallet} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px' }}>Connect Wallet</button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>My Staked Balance</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{mockStats.myStaked} {chain.token?.symbol}</div>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' }}>Unclaimed Rewards</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#16a34a' }}>+{mockStats.rewards} {chain.token?.symbol}</div>
                </div>
                <button style={{ width: '100%', padding: '0.75rem', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  Claim Rewards
                </button>
              </div>
            )}
          </div>

          {/* Right: Action Panel */}
          <div className={styles.card} style={{ padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
            
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setActiveTab('stake')}
                style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'stake' ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === 'stake' ? '#3b82f6' : '#64748b', fontWeight: '600', cursor: 'pointer' }}
              >
                Stake
              </button>
              <button 
                onClick={() => setActiveTab('unstake')}
                style={{ flex: 1, padding: '1rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'unstake' ? '2px solid #3b82f6' : '2px solid transparent', color: activeTab === 'unstake' ? '#3b82f6' : '#64748b', fontWeight: '600', cursor: 'pointer' }}
              >
                Unstake
              </button>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: '500', color: '#475569' }}>Amount</label>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Balance: {wallet ? '10,000.00' : '0.00'} {chain.token?.symbol}</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ width: '100%', padding: '1rem', fontSize: '1.5rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
                />
                <button 
                  style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: '#f1f5f9', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
                  onClick={() => setAmount(wallet ? (activeTab === 'stake' ? '10000' : mockStats.myStaked.replace(',','')) : '0')}
                >
                  MAX
                </button>
              </div>
            </div>

            {!wallet ? (
              <button 
                onClick={connectWallet}
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: '600', background: '#0f172a', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
              >
                Connect Wallet
              </button>
            ) : (
              <button 
                onClick={handleAction}
                disabled={processing}
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: '600', background: processing ? '#94a3b8' : '#3b82f6', color: 'white', borderRadius: '12px', border: 'none', cursor: processing ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
              >
                {processing ? 'Processing...' : activeTab === 'stake' ? 'Stake Tokens' : 'Unstake Tokens'}
              </button>
            )}

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
