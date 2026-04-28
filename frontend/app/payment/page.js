'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '../../lib/api';
import styles from './payment.module.css';

// ── Plan definitions (mirrors backend) ───────────────────
const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    icon: '🥉',
    ethPrice: '0.1',
    mainnets: 1,
    validators: 1,
    testnets: 3,
    features: ['1 Mainnet', '1 Validator Node', '3 Testnets', '30-day SLA', 'Basic Support'],
  },
  {
    id: 'standard',
    name: 'Standard',
    icon: '🥈',
    ethPrice: '0.3',
    mainnets: 2,
    validators: 3,
    testnets: 10,
    popular: true,
    features: ['2 Mainnets', '3 Validator Nodes', '10 Testnets', '90-day SLA', 'Priority Support', 'Block Explorer'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    icon: '🥇',
    ethPrice: '1.0',
    mainnets: 5,
    validators: 10,
    testnets: 50,
    features: ['5 Mainnets', '10 Validator Nodes', '50 Testnets', '1-year SLA', '24/7 Support', 'Custom Domain', 'Analytics'],
  },
];

const ADDON_PRICES = { extraChain: '1.0', extraNode: '0.2' };

const CURRENCIES = [
  { id: 'ETH',   name: 'Ethereum',  icon: '⟠',  primary: true  },
  { id: 'BTC',   name: 'Bitcoin',   icon: '₿',  primary: true  },
  { id: 'BNB',   name: 'BNB',       icon: '💛', primary: false },
  { id: 'MATIC', name: 'Polygon',   icon: '💜', primary: false },
  { id: 'USDT',  name: 'USDT',      icon: '💲', primary: false },
  { id: 'USDC',  name: 'USDC',      icon: '💵', primary: false },
  { id: 'SOL',   name: 'Solana',    icon: '🟣', primary: false },
];

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chainId = searchParams.get('chain');

  const [selectedPlan, setSelectedPlan]       = useState('standard');
  const [selectedCurrency, setSelectedCurrency] = useState('ETH');
  const [extraChains, setExtraChains]         = useState(0);
  const [extraNodes, setExtraNodes]           = useState(0);
  const [step, setStep]                       = useState('plan');
  const [txHash, setTxHash]                   = useState('');
  const [processing, setProcessing]           = useState(false);
  const [paymentData, setPaymentData]         = useState(null);
  const [livePrices, setLivePrices]           = useState({});
  const [convertedAmount, setConvertedAmount] = useState(null);
  const [loadingConvert, setLoadingConvert]   = useState(false);

  // Load live prices on mount
  useEffect(() => {
    api.request('/payment/pricing').then(res => {
      if (res.success) setLivePrices(res.data.livePrices || {});
    }).catch(() => {});
  }, []);

  // Auto-convert when currency or plan+addons changes
  useEffect(() => {
    if (!selectedCurrency || selectedCurrency === 'ETH') {
      setConvertedAmount(null);
      return;
    }
    const plan = PLANS.find(p => p.id === selectedPlan);
    if (!plan) return;

    const totalEth = (
      parseFloat(plan.ethPrice) +
      extraChains * parseFloat(ADDON_PRICES.extraChain) +
      extraNodes  * parseFloat(ADDON_PRICES.extraNode)
    ).toFixed(6);

    setLoadingConvert(true);
    api.request(`/payment/convert?ethAmount=${totalEth}&currency=${selectedCurrency}`)
      .then(res => {
        if (res.success) setConvertedAmount(res.data);
      })
      .finally(() => setLoadingConvert(false));
  }, [selectedCurrency, selectedPlan, extraChains, extraNodes]);

  const getTotalEth = () => {
    const plan = PLANS.find(p => p.id === selectedPlan);
    return (
      parseFloat(plan?.ethPrice || 0) +
      extraChains * parseFloat(ADDON_PRICES.extraChain) +
      extraNodes  * parseFloat(ADDON_PRICES.extraNode)
    ).toFixed(6);
  };

  const getUsdValue = () => {
    if (convertedAmount?.usdValue) return parseFloat(convertedAmount.usdValue).toFixed(2);
    const eth = parseFloat(getTotalEth());
    const ethUsd = livePrices?.ETH;
    if (!ethUsd) return null;
    return (eth * ethUsd).toFixed(2);
  };

  const getDisplayAmount = () => {
    if (loadingConvert) return 'Calculating...';
    if (selectedCurrency === 'ETH') return `${getTotalEth()} ETH`;
    // If converted amount is available and not null
    if (convertedAmount?.convertedAmount && convertedAmount.convertedAmount !== 'null') {
      return `${convertedAmount.convertedAmount} ${selectedCurrency}`;
    }
    // Fallback: show ETH amount with note
    return `${getTotalEth()} ETH (price loading...)`;
  };

  const handleProceedToPayment = async () => {
    if (!chainId) {
      alert('No chain selected. Go to dashboard and select a chain first.');
      return;
    }
    try {
      const res = await api.request('/payment/create', {
        method: 'POST',
        body: JSON.stringify({ chainId, plan: selectedPlan, currency: selectedCurrency, extraChains, extraNodes }),
      });
      if (res.success) {
        setPaymentData(res.data);
        setStep('payment');
      } else {
        alert(res.error || 'Failed to create payment.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVerifyPayment = async () => {
    if (!txHash.trim()) {
      alert('Please paste the transaction hash.');
      return;
    }
    setProcessing(true);
    setStep('processing');
    try {
      const res = await api.request('/payment/verify', {
        method: 'POST',
        body: JSON.stringify({ paymentId: paymentData.payment._id, txHash }),
      });
      if (res.success) {
        await api.request(`/deploy/mainnet/${chainId}`, { method: 'POST', body: JSON.stringify({ paymentId: paymentData.payment._id }) });
        setTimeout(() => { setStep('success'); setProcessing(false); }, 2000);
      } else {
        alert(res.error || 'Verification failed.');
        setStep('payment');
        setProcessing(false);
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
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>← Dashboard</button>
        </div>
      </header>

      <main className={styles.main}>

        {/* ── STEP 1: Plan Selection ── */}
        {step === 'plan' && (
          <div className={styles.planStep}>
            <div className={styles.stepHeader}>
              <h1 className={styles.title}>Launch to <span className="gradient-text">Mainnet</span></h1>
              <p className={styles.subtitle}>Choose your plan, add extras, pay with ETH or BTC</p>
            </div>

            {/* Plans */}
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
                    <span className={styles.priceAmount}>{p.ethPrice}</span>
                    <span className={styles.priceCurrency}>ETH</span>
                  </div>
                  {livePrices.ETH && (
                    <div className={styles.usdPrice}>≈ ${(parseFloat(p.ethPrice) * livePrices.ETH).toFixed(0)} USD</div>
                  )}
                  <ul className={styles.planFeatures}>
                    {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            {/* Addons */}
            <div className={styles.addonsSection}>
              <h3>⚡ Add-ons</h3>
              <div className={styles.addonGrid}>
                <div className={styles.addonCard}>
                  <div className={styles.addonInfo}>
                    <span className={styles.addonIcon}>⛓️</span>
                    <div>
                      <div className={styles.addonLabel}>Extra Mainnet Chain</div>
                      <div className={styles.addonPrice}>+1.0 ETH each</div>
                    </div>
                  </div>
                  <div className={styles.addonControls}>
                    <button className={styles.addonBtn} onClick={() => setExtraChains(Math.max(0, extraChains - 1))}>−</button>
                    <span className={styles.addonCount}>{extraChains}</span>
                    <button className={styles.addonBtn} onClick={() => setExtraChains(extraChains + 1)}>+</button>
                  </div>
                </div>

                <div className={styles.addonCard}>
                  <div className={styles.addonInfo}>
                    <span className={styles.addonIcon}>🖥️</span>
                    <div>
                      <div className={styles.addonLabel}>Extra Validator Node</div>
                      <div className={styles.addonPrice}>+0.2 ETH each</div>
                    </div>
                  </div>
                  <div className={styles.addonControls}>
                    <button className={styles.addonBtn} onClick={() => setExtraNodes(Math.max(0, extraNodes - 1))}>−</button>
                    <span className={styles.addonCount}>{extraNodes}</span>
                    <button className={styles.addonBtn} onClick={() => setExtraNodes(extraNodes + 1)}>+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Currency */}
            <div className={styles.currencySection}>
              <h3>💳 Pay With</h3>
              <div className={styles.currencyNote}>Primary: ETH & BTC — Others auto-calculated to ETH equivalent</div>
              <div className={styles.currencyGrid}>
                {CURRENCIES.map((c) => (
                  <button
                    key={c.id}
                    className={`${styles.currencyBtn} ${selectedCurrency === c.id ? styles.currencyBtnActive : ''} ${c.primary ? styles.currencyPrimary : ''}`}
                    onClick={() => setSelectedCurrency(c.id)}
                  >
                    <span className={styles.currencyIcon}>{c.icon}</span>
                    <span>{c.name}</span>
                    {c.primary && <span className={styles.primaryBadge}>Primary</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className={styles.actionBar}>
              <div className={styles.totalBox}>
                <div className={styles.totalRow}>
                  <span>Plan ({plan?.name}):</span>
                  <strong>{plan?.ethPrice} ETH</strong>
                </div>
                {extraChains > 0 && (
                  <div className={styles.totalRow}>
                    <span>+{extraChains} Chain(s):</span>
                    <strong>{(extraChains * 1.0).toFixed(1)} ETH</strong>
                  </div>
                )}
                {extraNodes > 0 && (
                  <div className={styles.totalRow}>
                    <span>+{extraNodes} Node(s):</span>
                    <strong>{(extraNodes * 0.2).toFixed(1)} ETH</strong>
                  </div>
                )}
                <div className={`${styles.totalRow} ${styles.totalFinal}`}>
                  <span>Total:</span>
                  <strong className="gradient-text">
                    {loadingConvert ? 'Calculating...' : getDisplayAmount()}
                  </strong>
                </div>
                {getUsdValue() && (
                  <div className={styles.usdEquiv}>≈ ${getUsdValue()} USD</div>
                )}
                {convertedAmount && selectedCurrency !== 'ETH' && (
                  <div className={styles.ethEquiv}>= {getTotalEth()} ETH</div>
                )}
              </div>
              <button className="btn btn-primary btn-lg" onClick={handleProceedToPayment}>
                Proceed to Payment →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Payment ── */}
        {step === 'payment' && paymentData && (
          <div className={styles.paymentStep}>
            <div className={styles.stepHeader}>
              <h1 className={styles.title}>Complete <span className="gradient-text">Payment</span></h1>
              <p className={styles.subtitle}>Send the exact amount to the address below</p>
            </div>

            <div className={styles.paymentCard}>
              <div className={styles.paymentInfo}>
                <div className={styles.paymentRow}><span>Plan</span><strong>{plan?.icon} {plan?.name}</strong></div>
                <div className={styles.paymentRow}><span>Currency</span><strong>{currency?.icon} {selectedCurrency}</strong></div>
                <div className={styles.paymentRow}>
                  <span>Amount to Send</span>
                  <strong className={styles.paymentAmount}>{paymentData.amount} {selectedCurrency}</strong>
                </div>
                {paymentData.usdValue && (
                  <div className={styles.paymentRow}><span>USD Value</span><strong>≈ ${paymentData.usdValue}</strong></div>
                )}
                {selectedCurrency !== 'ETH' && (
                  <div className={styles.paymentNote}>
                    ⚠️ Non-primary currency: send equivalent of {paymentData.totalEth} ETH in {selectedCurrency}
                  </div>
                )}
              </div>

              <div className={styles.walletAddress}>
                <label>Send to this {selectedCurrency} wallet:</label>
                <div className={styles.addressBox}>
                  <code>{paymentData.payTo}</code>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(paymentData.payTo)}>📋 Copy</button>
                </div>
              </div>

              {paymentData.breakdown && (
                <div className={styles.breakdown}>
                  <div className={styles.breakdownTitle}>Price Breakdown</div>
                  {Object.entries(paymentData.breakdown).filter(([,v]) => v).map(([k, v]) => (
                    <div key={k} className={styles.breakdownRow}><span>{k}:</span><span>{v}</span></div>
                  ))}
                </div>
              )}

              <div className={styles.txSection}>
                <label className="input-label">Transaction Hash (after sending)</label>
                <input
                  type="text"
                  className="input"
                  placeholder={selectedCurrency === 'BTC' ? 'BTC txid (64 hex chars)' : '0x...'}
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                />
                <p className={styles.txHint}>Send payment first, then paste the tx hash for verification.</p>
              </div>

              <div className={styles.paymentActions}>
                <button className="btn btn-secondary" onClick={() => setStep('plan')}>← Back</button>
                <button className="btn btn-primary btn-lg" onClick={handleVerifyPayment}>✓ Verify Payment</button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Processing ── */}
        {step === 'processing' && (
          <div className={styles.processingStep}>
            <div className="spinner spinner-lg"></div>
            <h2>Verifying on Blockchain...</h2>
            <p>Checking {txHash.slice(0, 10)}... on {selectedCurrency} network.</p>
          </div>
        )}

        {/* ── STEP 4: Success ── */}
        {step === 'success' && (
          <div className={styles.successStep}>
            <div className={styles.successIcon}>🎉</div>
            <h2>Mainnet Deployed!</h2>
            <p>Your blockchain is live. Plan upgraded to <strong>{plan?.name}</strong>.</p>
            <div className={styles.successActions}>
              <button className="btn btn-primary btn-lg" onClick={() => router.push('/dashboard')}>Go to Dashboard</button>
              <button className="btn btn-secondary btn-lg" onClick={() => router.push('/explorer')}>Open Explorer</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#0f172a', color:'#94a3b8' }}>Loading...</div>}>
      <PaymentContent />
    </Suspense>
  );
}
