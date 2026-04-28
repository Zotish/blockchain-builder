'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../lib/api';
import styles from './payment.module.css';

const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '0.1',
    currency: 'ETH',
    features: ['1 Validator Node', 'Basic Support', '30-day SLA'],
    icon: '🥉',
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '0.3',
    currency: 'ETH',
    features: ['3 Validator Nodes', 'Priority Support', '90-day SLA', 'Block Explorer', 'Custom RPC'],
    icon: '🥈',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '1.0',
    currency: 'ETH',
    features: ['5+ Validator Nodes', '24/7 Support', '1-year SLA', 'Custom Domain', 'Analytics', 'White-label'],
    icon: '🥇',
  },
];

const CURRENCIES = [
  { id: 'ETH', name: 'Ethereum', icon: '⟠', network: 'Ethereum' },
  { id: 'BNB', name: 'BNB', icon: '💛', network: 'BNB Chain' },
  { id: 'MATIC', name: 'Polygon', icon: '💜', network: 'Polygon' },
  { id: 'USDT', name: 'USDT', icon: '💲', network: 'Ethereum' },
  { id: 'USDC', name: 'USDC', icon: '💵', network: 'Ethereum' },
];

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [selectedCurrency, setSelectedCurrency] = useState('ETH');
  const [step, setStep] = useState('plan'); // plan, payment, processing, success
  const [txHash, setTxHash] = useState('');
  const [processing, setProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const chainId = searchParams.get('chain');

  const handleProceedToPayment = async () => {
    if (!chainId) {
      alert('No chain selected. Please select a chain from the dashboard first.');
      return;
    }

    try {
      const res = await api.createPayment(chainId, selectedPlan, selectedCurrency);
      if (res.success) {
        setPaymentData(res.data);
        setStep('payment');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyPayment = async () => {
    if (!txHash.trim()) {
      alert('Please enter the transaction hash.');
      return;
    }

    setProcessing(true);
    setStep('processing');

    try {
      const res = await api.verifyPayment(paymentData.payment.id, txHash);
      if (res.success) {
        // Deploy to mainnet
        await api.deployMainnet(chainId, paymentData.payment.id);
        setTimeout(() => {
          setStep('success');
          setProcessing(false);
        }, 3000);
      }
    } catch (err) {
      alert(err.message);
      setStep('payment');
      setProcessing(false);
    }
  };

  const plan = PLANS.find(p => p.id === selectedPlan);
  const currency = CURRENCIES.find(c => c.id === selectedCurrency);

  return (
    <div className={styles.paymentPage}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo} onClick={() => router.push('/')}>
            <span>⛓️</span>
            <span className={styles.logoText}>Chain<span className={styles.logoAccent}>Forge</span></span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {step === 'plan' && (
          <div className={styles.planStep}>
            <div className={styles.stepHeader}>
              <h1 className={styles.title}>Launch to <span className="gradient-text">Mainnet</span></h1>
              <p className={styles.subtitle}>Choose your deployment plan and pay with crypto</p>
            </div>

            {/* Plan Selection */}
            <div className={styles.plansGrid}>
              {PLANS.map((p) => (
                <div
                  key={p.id}
                  className={`${styles.planCard} ${selectedPlan === p.id ? styles.planCardActive : ''} ${p.popular ? styles.planPopular : ''}`}
                  onClick={() => setSelectedPlan(p.id)}
                >
                  {p.popular && <div className={styles.popularBadge}>Most Popular</div>}
                  <div className={styles.planIcon}>{p.icon}</div>
                  <h3 className={styles.planName}>{p.name}</h3>
                  <div className={styles.planPrice}>
                    <span className={styles.priceAmount}>{p.price}</span>
                    <span className={styles.priceCurrency}>{p.currency}</span>
                  </div>
                  <ul className={styles.planFeatures}>
                    {p.features.map((f) => (
                      <li key={f}>✓ {f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Currency Selection */}
            <div className={styles.currencySection}>
              <h3>Pay With</h3>
              <div className={styles.currencyGrid}>
                {CURRENCIES.map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.currencyBtn} ${selectedCurrency === c.id ? styles.currencyBtnActive : ''}`}
                    onClick={() => setSelectedCurrency(c.id)}
                  >
                    <span className={styles.currencyIcon}>{c.icon}</span>
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.actionBar}>
              <div className={styles.totalPrice}>
                <span>Total:</span>
                <strong>{plan?.price} {selectedCurrency}</strong>
              </div>
              <button className="btn btn-primary btn-lg" onClick={handleProceedToPayment}>
                Proceed to Payment →
              </button>
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div className={styles.paymentStep}>
            <div className={styles.stepHeader}>
              <h1 className={styles.title}>Complete <span className="gradient-text">Payment</span></h1>
              <p className={styles.subtitle}>Send the exact amount to the wallet address below</p>
            </div>

            <div className={styles.paymentCard}>
              <div className={styles.paymentInfo}>
                <div className={styles.paymentRow}>
                  <span>Plan</span>
                  <strong>{plan?.name} ({plan?.icon})</strong>
                </div>
                <div className={styles.paymentRow}>
                  <span>Amount</span>
                  <strong className={styles.paymentAmount}>{plan?.price} {selectedCurrency}</strong>
                </div>
                <div className={styles.paymentRow}>
                  <span>Network</span>
                  <strong>{currency?.network}</strong>
                </div>
              </div>

              <div className={styles.walletAddress}>
                <label>Send to this wallet address:</label>
                <div className={styles.addressBox}>
                  <code>{paymentData?.payTo || '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38'}</code>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(paymentData?.payTo || '')}>
                    📋 Copy
                  </button>
                </div>
              </div>

              <div className={styles.txSection}>
                <label className="input-label">Transaction Hash</label>
                <input
                  type="text"
                  className="input"
                  placeholder="0x..."
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
                <p className={styles.txHint}>
                  After sending the payment, paste the transaction hash above to verify.
                </p>
              </div>

              <div className={styles.paymentActions}>
                <button className="btn btn-secondary" onClick={() => setStep('plan')}>
                  ← Back
                </button>
                <button className="btn btn-primary btn-lg" onClick={handleVerifyPayment}>
                  ✓ Verify Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className={styles.processingStep}>
            <div className="spinner spinner-lg"></div>
            <h2>Verifying Payment...</h2>
            <p>Please wait while we confirm your transaction on the blockchain.</p>
            <div className="progress-bar" style={{ maxWidth: 400, margin: '24px auto' }}>
              <div className="progress-fill" style={{ width: '60%', animation: 'shimmer 2s infinite' }}></div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className={styles.successStep}>
            <div className={styles.successIcon}>🎉</div>
            <h2>Mainnet Deployed Successfully!</h2>
            <p>Your blockchain is now live on mainnet. Congratulations!</p>
            <div className={styles.successActions}>
              <button className="btn btn-primary btn-lg" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => router.push('/explorer')}>
                Open Explorer
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
export default function PaymentPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f172a', color: '#94a3b8' }}>Loading...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
