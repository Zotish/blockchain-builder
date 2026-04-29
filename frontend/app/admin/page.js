'use client';

import { useState, useEffect } from 'react';
import api from '../../lib/api';
import styles from './admin.module.css';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await api.getAdminStats();
        if (res.success) {
          setStats(res.data);
        } else {
          setError(res.error || 'Unauthorized access');
        }
      } catch (err) {
        setError('Failed to connect to admin services');
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) return <div className={styles.container}><p>Loading Analytics...</p></div>;
  if (error) return <div className={styles.container}><p className={styles.error}>{error}</p></div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Admin Analytics Dashboard</h1>
      <p className={styles.subtitle}>Real-time monitoring of infrastructure and platform growth.</p>

      {/* Platform Summary */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Users</div>
          <div className={styles.statValue}>{stats.summary.totalUsers}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Chains</div>
          <div className={styles.statValue}>{stats.summary.totalChains}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Active Nodes</div>
          <div className={styles.statValue}>{stats.summary.activeChains}</div>
        </div>
      </div>

      {/* VPS Health Status */}
      <div className={styles.healthSection}>
        <h2 className={styles.sectionTitle}>🖥️ VPS Server Health (Hetzner)</h2>
        <div className={styles.healthGrid}>
          <div className={styles.healthItem}>
            <span>CPU Usage</span>
            <div className={styles.progressBar}><div style={{ width: stats.vpsHealth.cpu }}></div></div>
            <span className={styles.percent}>{stats.vpsHealth.cpu}</span>
          </div>
          <div className={styles.healthItem}>
            <span>RAM Usage</span>
            <div className={styles.progressBar}><div style={{ width: stats.vpsHealth.ram }}></div></div>
            <span className={styles.percent}>{stats.vpsHealth.ram}</span>
          </div>
          <div className={styles.healthItem}>
            <span>Disk Space</span>
            <div className={styles.progressBar}><div style={{ width: stats.vpsHealth.disk }}></div></div>
            <span className={styles.percent}>{stats.vpsHealth.disk}</span>
          </div>
          <div className={styles.healthItem}>
            <span>Running Containers</span>
            <div className={styles.containerCount}>{stats.vpsHealth.containers}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
