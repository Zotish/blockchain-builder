'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { useChainStats } from '../../lib/socket';
import styles from './dashboard.module.css';

// ── Live stats row (subscribes individually per deployed chain) ──
function ChainStatsRow({ chain }) {
  const [liveStats, setLiveStats] = useState(chain.stats || {});

  // Only subscribe to live stats if the chain is deployed
  useChainStats(
    chain.status === 'deployed' ? (chain._id || chain.id) : null,
    useCallback((stats) => setLiveStats(stats), [])
  );

  return (
    <div className={styles.chainLiveStats}>
      <span className={styles.liveStat} title="Block Height">
        📦 {liveStats.blockHeight?.toLocaleString() ?? '—'}
      </span>
      <span className={styles.liveStat} title="Transactions">
        📄 {liveStats.txCount?.toLocaleString() ?? '—'} txns
      </span>
      <span className={styles.liveStat} title="Peers">
        🔌 {liveStats.peers ?? '—'} peers
      </span>
      {chain.status === 'deployed' && (
        <span className={styles.liveDot} title="Live" />
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [chains, setChains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const storedUser = api.getUser();
      if (!storedUser && !api.token) { router.push('/auth'); return; }
      setUser(storedUser);

      const res = await api.getChains();
      if (res.success) setChains(res.data.chains);
    } catch (err) {
      console.error('Dashboard load error:', err);
      if (err.message.includes('401') || err.message.includes('token')) router.push('/auth');
    } finally {
      setLoading(false);
    }
  };

  const deleteChain = async (chainId) => {
    if (!confirm('Are you sure you want to delete this chain?')) return;
    try {
      await api.deleteChain(chainId);
      setChains(prev => prev.filter(c => (c._id || c.id) !== chainId));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const logout = () => { api.logout(); router.push('/'); };

  const filteredChains = activeTab === 'all'
    ? chains
    : chains.filter(c => c.status === activeTab || c.network === activeTab);

  const getStatusBadge = (status) => {
    const map = { deployed: 'success', deploying: 'warning', draft: 'info', failed: 'danger', stopped: 'danger' };
    return map[status] || 'primary';
  };

  const getTypeIcon = (type) => {
    const icons = { evm: '⟠', substrate: '⚪', cosmos: '⚛️', hyperledger: '🏢', solana: '🟢', dag: '🕸️', custom: '🔧' };
    return icons[type] || '🔗';
  };

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className="spinner spinner-lg"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardPage}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo} onClick={() => router.push('/')}>
            <span>⛓️</span>
            <span className={styles.logoText}>Chain<span className={styles.logoAccent}>Forge</span></span>
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navSection}>
            <span className={styles.navLabel}>Main</span>
            <button className={`${styles.navItem} ${styles.navItemActive}`}><span>📊</span> Dashboard</button>
            <button className={styles.navItem} onClick={() => router.push('/builder')}><span>🔨</span> Chain Builder</button>
            <button className={styles.navItem} onClick={() => router.push('/explorer')}><span>🔍</span> Explorer</button>
          </div>
          <div className={styles.navSection}>
            <span className={styles.navLabel}>Account</span>
            <button className={styles.navItem} onClick={() => router.push('/payment')}><span>💳</span> Payments</button>
            <button className={styles.navItem}><span>⚙️</span> Settings</button>
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>{user?.username?.charAt(0).toUpperCase() || '?'}</div>
            <div className={styles.userDetails}>
              <span className={styles.userName}>{user?.username || 'User'}</span>
              <span className={styles.userEmail}>{user?.email || ''}</span>
            </div>
          </div>
          <button className={`btn btn-ghost btn-sm ${styles.logoutBtn}`} onClick={logout}>Logout</button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        {/* Top Bar */}
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.pageSubtitle}>Manage your blockchain networks</p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/builder')}>+ New Chain</button>
        </div>

        {/* Stats Cards */}
        <div className={styles.statsGrid}>
          {[
            { icon: '🔗', value: chains.length, label: 'Total Chains' },
            { icon: '✅', value: chains.filter(c => c.status === 'deployed').length, label: 'Deployed' },
            { icon: '🧪', value: chains.filter(c => c.network === 'testnet').length, label: 'Testnets' },
            { icon: '🌐', value: chains.filter(c => c.network === 'mainnet').length, label: 'Mainnets' },
          ].map(s => (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div>
                <div className={styles.statValue}>{s.value}</div>
                <div className={styles.statLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className={styles.tabBar}>
          {['all', 'draft', 'deployed', 'testnet', 'mainnet'].map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'all' && <span className={styles.tabCount}>{chains.length}</span>}
            </button>
          ))}
        </div>

        {/* Chain List */}
        {filteredChains.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⛓️</div>
            <h3>No Chains Yet</h3>
            <p>Create your first blockchain network to get started.</p>
            <button className="btn btn-primary" onClick={() => router.push('/builder')}>
              🚀 Create Your First Chain
            </button>
          </div>
        ) : (
          <div className={styles.chainsList}>
            {filteredChains.map(chain => {
              const id = chain._id || chain.id;
              return (
                <div key={id} className={styles.chainRow}>
                  <div className={styles.chainIcon}>{getTypeIcon(chain.type)}</div>
                  <div className={styles.chainInfo} onClick={() => router.push(`/chain/${id}`)} style={{ cursor: 'pointer' }}>
                    <h3 className={styles.chainName}>{chain.name}</h3>
                    <div className={styles.chainMeta}>
                      <span>{chain.type?.toUpperCase()}</span>
                      <span>•</span>
                      <span>ID: {chain.config?.chainId}</span>
                      <span>•</span>
                      <span>{chain.config?.consensus?.toUpperCase()}</span>
                    </div>
                    {/* ← Live real-time stats via WebSocket */}
                    <ChainStatsRow chain={chain} />
                  </div>
                  <div className={styles.chainStatus}>
                    <span className={`badge badge-${getStatusBadge(chain.status)}`}>{chain.status}</span>
                    <span className={`badge badge-${chain.network === 'mainnet' ? 'success' : 'info'}`}>{chain.network}</span>
                  </div>
                  <div className={styles.chainActions}>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/chain/${id}`)}>📡 Details</button>
                    {chain.status === 'deployed' && chain.network === 'testnet' && (
                      <button className="btn btn-primary btn-sm" onClick={() => router.push(`/payment?chain=${id}`)}>
                        🚀 Launch Mainnet
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push(`/explorer?chain=${id}`)}>🔍</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => deleteChain(id)} style={{ color: 'var(--accent-rose)' }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        <div className={styles.quickActions}>
          <h2 className={styles.sectionTitle}>Quick Start Templates</h2>
          <div className={styles.quickGrid}>
            {[
              { icon: '⟠', name: 'Ethereum PoS', desc: 'Deploy a full Ethereum PoS chain' },
              { icon: '💛', name: 'BNB Chain', desc: 'High-speed DPoS chain' },
              { icon: '⚛️', name: 'Cosmos Chain', desc: 'Tendermint BFT powered' },
              { icon: '🔧', name: 'Custom Chain', desc: 'Build from scratch' },
            ].map(t => (
              <div key={t.name} className={`card ${styles.quickCard}`} onClick={() => router.push('/builder')}>
                <span className={styles.quickIcon}>{t.icon}</span>
                <h3>{t.name}</h3>
                <p>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
