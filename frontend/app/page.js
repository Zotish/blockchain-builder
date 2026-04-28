'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const CHAIN_TYPES = [
  { icon: '⟠', name: 'Ethereum', color: '#627eea' },
  { icon: '💛', name: 'BNB Chain', color: '#f0b90b' },
  { icon: '💜', name: 'Polygon', color: '#8247e5' },
  { icon: '⚛️', name: 'Cosmos', color: '#2e3148' },
  { icon: '⚪', name: 'Substrate', color: '#e6007a' },
  { icon: '🔺', name: 'Avalanche', color: '#e84142' },
  { icon: '🟢', name: 'Solana', color: '#14f195' },
  { icon: '🐝', name: 'Hyperledger', color: '#2f3134' },
  { icon: '🔧', name: 'Custom', color: '#6366f1' },
];

const STATS = [
  { value: '20+', label: 'Chain Templates' },
  { value: '< 5min', label: 'Deploy Time' },
  { value: 'Free', label: 'Testnet' },
  { value: '∞', label: 'Possibilities' },
];

const FEATURES = [
  {
    icon: '🧱',
    title: 'Visual Chain Builder',
    description: 'Configure every aspect of your blockchain with an intuitive wizard. No coding required for basic chains.',
  },
  {
    icon: '🚀',
    title: 'One-Click Deploy',
    description: 'Deploy to testnet instantly for free. Launch your mainnet when you\'re ready with a simple crypto payment.',
  },
  {
    icon: '🔗',
    title: 'Any Chain Type',
    description: 'EVM, Substrate, Cosmos SDK, Hyperledger, Solana, DAG-based, or build something entirely custom.',
  },
  {
    icon: '📊',
    title: 'Real-Time Dashboard',
    description: 'Monitor blocks, transactions, nodes, and network health in real-time with a beautiful dashboard.',
  },
  {
    icon: '🔍',
    title: 'Built-in Explorer',
    description: 'Every chain gets its own block explorer. Browse blocks, transactions, and accounts instantly.',
  },
  {
    icon: '🔐',
    title: 'Enterprise Security',
    description: 'Docker-isolated nodes, encrypted configs, and battle-tested consensus implementations.',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Choose Your Chain Type',
    description: 'Select from 20+ templates or start from scratch with full customization.',
    color: '#6366f1',
  },
  {
    step: '02',
    title: 'Configure Parameters',
    description: 'Set consensus, block time, gas limits, token economics, and governance rules.',
    color: '#8b5cf6',
  },
  {
    step: '03',
    title: 'Deploy to Testnet',
    description: 'Launch your chain on testnet for free. Test everything before going live.',
    color: '#06b6d4',
  },
  {
    step: '04',
    title: 'Launch Mainnet',
    description: 'Pay with crypto and deploy your blockchain to production. You\'re live!',
    color: '#10b981',
  },
];

const PRICING = [
  {
    name: 'Testnet',
    price: 'Free',
    period: 'forever',
    description: 'Perfect for development & testing',
    features: ['Unlimited testnet chains', 'Full configuration', 'Block explorer', 'Faucet included', '72-hour auto-cleanup'],
    highlight: false,
    cta: 'Start Building',
  },
  {
    name: 'Standard',
    price: '0.3',
    currency: 'ETH',
    period: 'per chain',
    description: 'For serious projects',
    features: ['3 validator nodes', 'Priority support', '90-day uptime SLA', 'Block explorer', 'Custom RPC endpoint', 'Analytics dashboard'],
    highlight: true,
    cta: 'Get Started',
  },
  {
    name: 'Enterprise',
    price: '1.0',
    currency: 'ETH',
    period: 'per chain',
    description: 'Full infrastructure & support',
    features: ['5+ validator nodes', '24/7 dedicated support', '1-year uptime SLA', 'Custom domain', 'Advanced analytics', 'SLA guarantee', 'White-label explorer'],
    highlight: false,
    cta: 'Contact Us',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [scrollY, setScrollY] = useState(0);
  const [activeChain, setActiveChain] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveChain((prev) => (prev + 1) % CHAIN_TYPES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.page}>
      {/* Navigation */}
      <nav className={`${styles.nav} ${scrollY > 50 ? styles.navScrolled : ''}`}>
        <div className={styles.navInner}>
          <div className={styles.logo} onClick={() => router.push('/')}>
            <div className={styles.logoIcon}>⛓️</div>
            <span className={styles.logoText}>Chain<span className={styles.logoAccent}>Forge</span></span>
          </div>
          <div className={styles.navLinks}>
            <a href="#features" className={styles.navLink}>Features</a>
            <a href="#how-it-works" className={styles.navLink}>How It Works</a>
            <a href="#chains" className={styles.navLink}>Chains</a>
            <a href="#pricing" className={styles.navLink}>Pricing</a>
            <a href="/docs" className={styles.navLink}>Docs</a>
          </div>
          <div className={styles.navActions}>
            <button className="btn btn-ghost" onClick={() => router.push('/auth')}>Sign In</button>
            <button className="btn btn-primary" onClick={() => router.push('/auth?mode=register')}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.heroOrb1}></div>
          <div className={styles.heroOrb2}></div>
          <div className={styles.heroOrb3}></div>
          <div className={styles.gridOverlay}></div>
        </div>

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot}></span>
            Blockchain-as-a-Service Platform
          </div>

          <h1 className={styles.heroTitle}>
            Build <span className="gradient-text">Any Blockchain</span>
            <br />
            in Minutes
          </h1>

          <p className={styles.heroSubtitle}>
            Create, configure, and deploy any type of blockchain — from EVM chains 
            to Cosmos SDK, Substrate, and fully custom networks. Free testnet, 
            crypto-powered mainnet launch.
          </p>

          <div className={styles.heroActions}>
            <button className="btn btn-primary btn-lg" onClick={() => router.push('/builder')}>
              <span>🚀</span> Start Building
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => router.push('/dashboard')}>
              <span>📊</span> View Dashboard
            </button>
          </div>

          {/* Animated Chain Types */}
          <div className={styles.chainShowcase}>
            {CHAIN_TYPES.map((chain, i) => (
              <div
                key={chain.name}
                className={`${styles.chainIcon} ${i === activeChain ? styles.chainIconActive : ''}`}
                style={{ '--chain-color': chain.color }}
              >
                <span className={styles.chainEmoji}>{chain.icon}</span>
                <span className={styles.chainName}>{chain.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          {STATS.map((stat) => (
            <div key={stat.label} className={styles.statItem}>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Features</span>
            <h2 className={styles.sectionTitle}>
              Everything You Need to <span className="gradient-text">Build a Blockchain</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              From zero to a live blockchain network in minutes, not months.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            {FEATURES.map((feature, i) => (
              <div key={feature.title} className={`card ${styles.featureCard} animate-fade-in-up stagger-${i + 1}`}>
                <div className={styles.featureIcon}>{feature.icon}</div>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureDesc}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>How It Works</span>
            <h2 className={styles.sectionTitle}>
              Four Steps to <span className="gradient-text">Your Own Blockchain</span>
            </h2>
          </div>

          <div className={styles.stepsGrid}>
            {STEPS.map((step, i) => (
              <div key={step.step} className={styles.stepCard}>
                <div className={styles.stepNumber} style={{ color: step.color }}>{step.step}</div>
                <div className={styles.stepConnector}></div>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supported Chains */}
      <section id="chains" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Supported Chains</span>
            <h2 className={styles.sectionTitle}>
              Deploy <span className="gradient-text">Any Type</span> of Blockchain
            </h2>
            <p className={styles.sectionSubtitle}>
              Choose from pre-built templates or create something entirely new.
            </p>
          </div>

          <div className={styles.chainsGrid}>
            {[
              { icon: '⟠', name: 'Ethereum PoS', type: 'EVM', features: ['Smart Contracts', 'EIP-1559', 'Proof of Stake'] },
              { icon: '🔐', name: 'Ethereum PoA', type: 'EVM', features: ['Authority Nodes', 'Private Network', 'Low Latency'] },
              { icon: '💛', name: 'BNB Chain Clone', type: 'EVM', features: ['DPoS Consensus', 'Fast Blocks', 'Low Fees'] },
              { icon: '💜', name: 'Polygon Clone', type: 'EVM', features: ['PoS + Plasma', 'Checkpointing', 'High TPS'] },
              { icon: '🔺', name: 'Avalanche Subnet', type: 'EVM', features: ['Snowman Consensus', 'Sub-second Finality'] },
              { icon: '🔴', name: 'Optimistic Rollup', type: 'L2', features: ['Fraud Proofs', 'EVM Equivalent', 'L2 Scaling'] },
              { icon: '🟣', name: 'ZK-Rollup', type: 'L2', features: ['ZK Proofs', 'Instant Finality', 'Privacy'] },
              { icon: '⚪', name: 'Substrate Chain', type: 'Substrate', features: ['Forkless Upgrades', 'WASM Runtime'] },
              { icon: '🟡', name: 'Polkadot Parachain', type: 'Substrate', features: ['Shared Security', 'XCMP'] },
              { icon: '⚛️', name: 'Cosmos SDK', type: 'Cosmos', features: ['Tendermint BFT', 'IBC Ready'] },
              { icon: '🏢', name: 'Hyperledger Fabric', type: 'Enterprise', features: ['Permissioned', 'Channels'] },
              { icon: '🟢', name: 'Solana Fork', type: 'High-Perf', features: ['Proof of History', '65k TPS'] },
              { icon: '🕸️', name: 'DAG-Based', type: 'DAG', features: ['Feeless', 'IoT Optimized'] },
              { icon: '🔧', name: 'Custom Chain', type: 'Custom', features: ['Full Control', 'Any Consensus'] },
            ].map((chain) => (
              <div key={chain.name} className={`card ${styles.chainCard}`}>
                <div className={styles.chainCardIcon}>{chain.icon}</div>
                <h3 className={styles.chainCardName}>{chain.name}</h3>
                <span className="badge badge-primary">{chain.type}</span>
                <div className={styles.chainCardFeatures}>
                  {chain.features.map((f) => (
                    <span key={f} className={styles.chainFeatureTag}>✓ {f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Pricing</span>
            <h2 className={styles.sectionTitle}>
              Simple, <span className="gradient-text">Transparent Pricing</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              Free testnet forever. Pay only when you're ready for mainnet.
            </p>
          </div>

          <div className={styles.pricingGrid}>
            {PRICING.map((plan) => (
              <div key={plan.name} className={`${styles.pricingCard} ${plan.highlight ? styles.pricingHighlight : ''}`}>
                {plan.highlight && <div className={styles.pricingBadge}>Most Popular</div>}
                <h3 className={styles.pricingName}>{plan.name}</h3>
                <div className={styles.pricingPrice}>
                  <span className={styles.pricingAmount}>{plan.price}</span>
                  {plan.currency && <span className={styles.pricingCurrency}>{plan.currency}</span>}
                </div>
                <p className={styles.pricingPeriod}>{plan.period}</p>
                <p className={styles.pricingDesc}>{plan.description}</p>
                <ul className={styles.pricingFeatures}>
                  {plan.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                <button
                  className={`btn ${plan.highlight ? 'btn-primary' : 'btn-secondary'} ${styles.pricingCta}`}
                  onClick={() => router.push('/builder')}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>
              Ready to Build Your <span className="gradient-text">Blockchain</span>?
            </h2>
            <p className={styles.ctaSubtitle}>
              Join the future of decentralized infrastructure. Start building for free today.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => router.push('/builder')}>
              🚀 Launch Chain Builder
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className="container">
          <div className={styles.footerContent}>
            <div className={styles.footerBrand}>
              <div className={styles.logo}>
                <div className={styles.logoIcon}>⛓️</div>
                <span className={styles.logoText}>Chain<span className={styles.logoAccent}>Forge</span></span>
              </div>
              <p className={styles.footerDesc}>
                The ultimate Blockchain-as-a-Service platform. Create, configure, and deploy any blockchain.
              </p>
            </div>
            <div className={styles.footerLinks}>
              <div>
                <h4>Product</h4>
                <a href="/builder">Chain Builder</a>
                <a href="/dashboard">Dashboard</a>
                <a href="/explorer">Explorer</a>
              </div>
              <div>
                <h4>Resources</h4>
                <a href="/docs">Documentation</a>
                <a href="/docs">API Reference</a>
                <a href="/builder">Templates</a>
              </div>
              <div>
                <h4>Company</h4>
                <a href="#">About</a>
                <a href="#">Blog</a>
                <a href="#">Contact</a>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <p>© 2026 ChainForge. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
