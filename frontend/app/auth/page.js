'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../lib/api';
import styles from './auth.module.css';

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
  });

  useEffect(() => {
    if (searchParams.get('mode') === 'register') {
      setIsLogin(false);
    }
    // Check if already logged in
    const token = api.token;
    if (token) {
      router.push('/dashboard');
    }
  }, [searchParams, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await api.login(formData.email, formData.password);
      } else {
        if (!formData.username) {
          setError('Username is required');
          setLoading(false);
          return;
        }
        await api.register(formData.email, formData.password, formData.username);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.authBackground}>
        <div className={styles.orb1}></div>
        <div className={styles.orb2}></div>
        <div className={styles.gridOverlay}></div>
      </div>

      <div className={styles.authContainer}>
        {/* Left - Branding */}
        <div className={styles.authBranding}>
          <div className={styles.brandContent}>
            <div className={styles.logo} onClick={() => router.push('/')}>
              <span className={styles.logoIcon}>⛓️</span>
              <span className={styles.logoText}>Chain<span className={styles.logoAccent}>Forge</span></span>
            </div>
            <h2 className={styles.brandTitle}>
              Build the <span className="gradient-text">Future</span> of Blockchain
            </h2>
            <p className={styles.brandSubtitle}>
              Create, deploy, and manage any type of blockchain network. From testnet to mainnet in minutes.
            </p>
            <div className={styles.brandFeatures}>
              <div className={styles.brandFeature}>
                <span>🚀</span> One-click testnet deployment
              </div>
              <div className={styles.brandFeature}>
                <span>🔗</span> 20+ chain templates
              </div>
              <div className={styles.brandFeature}>
                <span>💰</span> Crypto-powered mainnet launch
              </div>
              <div className={styles.brandFeature}>
                <span>📊</span> Real-time monitoring
              </div>
            </div>
          </div>
        </div>

        {/* Right - Form */}
        <div className={styles.authForm}>
          <div className={styles.formContent}>
            <h1 className={styles.formTitle}>
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className={styles.formSubtitle}>
              {isLogin ? 'Sign in to your ChainForge account' : 'Start building your blockchain today'}
            </p>

            {error && (
              <div className={styles.errorBox}>
                <span>⚠️</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              {!isLogin && (
                <div className="input-group">
                  <label className="input-label">Username</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Choose a username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required={!isLogin}
                  />
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>

              <button type="submit" className={`btn btn-primary btn-lg ${styles.submitBtn}`} disabled={loading}>
                {loading ? (
                  <><span className="spinner"></span> Processing...</>
                ) : isLogin ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className={styles.divider}>
              <span>or</span>
            </div>

            <button className={`btn btn-secondary ${styles.walletBtn}`}>
              <span>🦊</span> Connect with MetaMask
            </button>

            <p className={styles.switchMode}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button className={styles.switchBtn} onClick={() => { setIsLogin(!isLogin); setError(''); }}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
