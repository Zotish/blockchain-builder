'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../../../lib/api';
import styles from '../../public-explorer.module.css';

export default function BridgePage() {
  const params = useParams();
  const router = useRouter();
  const { chainId } = params;

  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState('deposit'); // 'deposit' or 'withdraw'
  const [wallet, setWallet] = useState(null);
  const [bridging, setBridging] = useState(false);

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

  const handleBridge = async () => {
    if (!wallet) return alert('Please connect your wallet first.');
    if (!amount || parseFloat(amount) <= 0) return alert('Enter a valid amount.');
    
    setBridging(true);
    
    // Simulating Bridge Delay
    setTimeout(() => {
      setBridging(false);
      setAmount('');
      alert(`🎉 Successfully ${direction === 'deposit' ? 'bridged to' : 'withdrawn from'} ${chain.name}!\n\n(Note: This is a simulation interface. Smart contract locking not integrated yet.)`);
    }, 2500);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading Bridge...</p>
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
            <span className={styles.navLinkActive} onClick={() => router.push(`/explorer/${chainId}/bridge`)}>Bridge</span>
            <span className={styles.navLink} onClick={() => router.push(`/explorer/${chainId}/staking`)}>Staking</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.contentSection} style={{ marginTop: '2rem', maxWidth: '600px', margin: '2rem auto' }}>
        <h1 style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '0.5rem' }}>Cross-Chain Bridge</h1>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem' }}>Transfer assets securely between Ethereum and {chain.name}</p>
        
        <div className={styles.card} style={{ padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          
          {/* Network Selection */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', position: 'relative' }}>
            <div style={{ flex: 1, padding: '1rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase' }}>From</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{direction === 'deposit' ? 'Ethereum (Sepolia)' : chain.name}</div>
            </div>
            
            <button 
              onClick={() => setDirection(d => d === 'deposit' ? 'withdraw' : 'deposit')}
              style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', zIndex: 10, margin: '0 -20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 4px 6px rgba(59,130,246,0.3)' }}
            >
              ⇄
            </button>

            <div style={{ flex: 1, padding: '1rem', background: '#f8fafc', borderRadius: '12px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', marginBottom: '0.5rem', textTransform: 'uppercase' }}>To</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>{direction === 'deposit' ? chain.name : 'Ethereum (Sepolia)'}</div>
            </div>
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#475569', marginBottom: '0.5rem' }}>Amount to Bridge</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', padding: '1rem', fontSize: '1.5rem', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
              />
              <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: '600', color: '#0f172a' }}>
                {chain.token?.symbol || 'ETH'}
              </div>
            </div>
          </div>

          {/* Action Button */}
          {!wallet ? (
            <button 
              onClick={connectWallet}
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: '600', background: '#0f172a', color: 'white', borderRadius: '12px', border: 'none', cursor: 'pointer' }}
            >
              Connect Wallet
            </button>
          ) : (
            <button 
              onClick={handleBridge}
              disabled={bridging}
              style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', fontWeight: '600', background: bridging ? '#94a3b8' : '#3b82f6', color: 'white', borderRadius: '12px', border: 'none', cursor: bridging ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}
            >
              {bridging ? 'Bridging Funds...' : 'Bridge Now'}
            </button>
          )}

          {wallet && (
            <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
              Connected: {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </div>
          )}

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
