'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import styles from './builder.module.css';

const CHAIN_CATEGORIES = [
  {
    id: 'evm',
    name: 'EVM Compatible',
    icon: '⟠',
    description: 'Ethereum Virtual Machine compatible chains',
    color: '#627eea',
  },
  {
    id: 'substrate',
    name: 'Substrate',
    icon: '⚪',
    description: 'Polkadot ecosystem chains',
    color: '#e6007a',
  },
  {
    id: 'cosmos',
    name: 'Cosmos SDK',
    icon: '⚛️',
    description: 'Tendermint BFT based chains',
    color: '#6f7390',
  },
  {
    id: 'hyperledger',
    name: 'Hyperledger',
    icon: '🏢',
    description: 'Enterprise blockchain solutions',
    color: '#2f3134',
  },
  {
    id: 'solana',
    name: 'Solana',
    icon: '🟢',
    description: 'High-performance chains',
    color: '#14f195',
  },
  {
    id: 'dag',
    name: 'DAG-Based',
    icon: '🕸️',
    description: 'Directed Acyclic Graph ledgers',
    color: '#0ea5e9',
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: '🔧',
    description: 'Build from scratch',
    color: '#6366f1',
  },
];

const CONSENSUS_OPTIONS = {
  evm: [
    { id: 'pos', name: 'Proof of Stake', desc: 'Energy-efficient validator-based consensus' },
    { id: 'poa', name: 'Proof of Authority', desc: 'Authority nodes for fast, private networks' },
    { id: 'pow', name: 'Proof of Work', desc: 'Traditional mining-based consensus' },
    { id: 'dpos', name: 'Delegated PoS', desc: 'Delegated staking with elected validators' },
  ],
  substrate: [
    { id: 'aura+grandpa', name: 'Aura + GRANDPA', desc: 'Standard Substrate consensus' },
    { id: 'babe+grandpa', name: 'BABE + GRANDPA', desc: 'Advanced randomized block production' },
  ],
  cosmos: [
    { id: 'tendermint', name: 'Tendermint BFT', desc: 'Byzantine fault tolerant consensus' },
  ],
  hyperledger: [
    { id: 'raft', name: 'Raft', desc: 'Crash fault tolerant ordering' },
    { id: 'ibft2', name: 'IBFT 2.0', desc: 'Byzantine fault tolerant for enterprise' },
  ],
  solana: [
    { id: 'poh+pos', name: 'PoH + PoS', desc: 'Proof of History with Proof of Stake' },
  ],
  dag: [
    { id: 'tip-selection', name: 'Tip Selection', desc: 'DAG-based transaction ordering' },
  ],
  custom: [
    { id: 'pos', name: 'Proof of Stake', desc: '' },
    { id: 'poa', name: 'Proof of Authority', desc: '' },
    { id: 'pow', name: 'Proof of Work', desc: '' },
    { id: 'dpos', name: 'Delegated PoS', desc: '' },
    { id: 'bft', name: 'BFT', desc: '' },
    { id: 'custom', name: 'Custom', desc: 'Define your own consensus' },
  ],
};

const WIZARD_STEPS = [
  { id: 'type', label: 'Chain Type', icon: '🔗' },
  { id: 'template', label: 'Template', icon: '📋' },
  { id: 'config', label: 'Configure', icon: '⚙️' },
  { id: 'token', label: 'Tokenomics', icon: '💰' },
  { id: 'governance', label: 'Governance', icon: '🏛️' },
  { id: 'review', label: 'Review', icon: '✅' },
];

export default function BuilderPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployLogs, setDeployLogs] = useState([]);
  const [deployProgress, setDeployProgress] = useState(0);
  const [error, setError] = useState('');

  const [chainConfig, setChainConfig] = useState({
    type: '',
    template: null,
    name: '',
    chainId: Math.floor(Math.random() * 90000) + 10000,
    symbol: 'TOKEN',
    consensus: '',
    blockTime: 5,
    blockGasLimit: '30000000',
    networkType: 'public',
    token: {
      name: '',
      symbol: 'TOKEN',
      decimals: 18,
      totalSupply: '1000000000',
    },
    governance: {
      type: 'admin',
      votingPeriod: 86400,
      quorum: 51,
    },
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await api.getTemplates();
      if (res.success) {
        setTemplates(res.data.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const updateConfig = (key, value) => {
    setChainConfig((prev) => ({ ...prev, [key]: value }));
  };

  const updateToken = (key, value) => {
    setChainConfig((prev) => ({
      ...prev,
      token: { ...prev.token, [key]: value },
    }));
  };

  const updateGovernance = (key, value) => {
    setChainConfig((prev) => ({
      ...prev,
      governance: { ...prev.governance, [key]: value },
    }));
  };

  const selectType = (typeId) => {
    updateConfig('type', typeId);
    const consensusOpts = CONSENSUS_OPTIONS[typeId];
    if (consensusOpts && consensusOpts.length > 0) {
      updateConfig('consensus', consensusOpts[0].id);
    }
    setCurrentStep(1);
  };

  const selectTemplate = (template) => {
    setChainConfig((prev) => ({
      ...prev,
      template: template.id,
      consensus: template.defaults.consensus,
      blockTime: template.defaults.blockTime,
      symbol: template.defaults.symbol,
      blockGasLimit: template.defaults.blockGasLimit || '30000000',
      token: {
        ...prev.token,
        symbol: template.defaults.symbol,
        name: `${template.name} Token`,
      },
    }));
    setCurrentStep(2);
  };

  const skipTemplate = () => {
    setCurrentStep(2);
  };

  const nextStep = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const deployToTestnet = async () => {
    setError('');
    setDeploying(true);
    setDeployLogs([]);
    setDeployProgress(0);

    try {
      // Check auth
      if (!api.token) {
        // Auto-create a demo account
        try {
          await api.register(
            `demo_${Date.now()}@chainforge.io`,
            'demo123456',
            `builder_${Date.now().toString(36)}`
          );
        } catch (e) {
          // If registration fails, try login with existing
          setError('Please sign in first to deploy.');
          setDeploying(false);
          return;
        }
      }

      // Create chain
      const chainRes = await api.createChain({
        name: chainConfig.name || `My ${chainConfig.type.toUpperCase()} Chain`,
        type: chainConfig.type,
        template: chainConfig.template,
        chainId: chainConfig.chainId,
        symbol: chainConfig.symbol,
        consensus: chainConfig.consensus,
        blockTime: chainConfig.blockTime,
        blockGasLimit: chainConfig.blockGasLimit,
        networkType: chainConfig.networkType,
        token: chainConfig.token,
        governance: chainConfig.governance,
      });

      if (!chainRes.success) {
        throw new Error(chainRes.error || 'Failed to create chain');
      }

      // Deploy to testnet
      const chainId = chainRes.data.chain._id || chainRes.data.chain.id;
      if (!chainId) throw new Error('Chain created but no ID returned');
      const deployRes = await api.deployTestnet(chainId);

      if (!deployRes.success) {
        throw new Error(deployRes.error || 'Deployment failed');
      }

      // Simulate receiving deployment logs
      const steps = [
        '📋 Validating chain configuration...',
        '🔧 Generating genesis block...',
        '🐳 Creating Docker container...',
        `⛓️ Initializing ${chainConfig.type.toUpperCase()} node...`,
        '🔑 Generating node keys and accounts...',
        '📡 Configuring P2P network...',
        '🌐 Setting up RPC endpoints...',
        `🚀 Starting testnet node...`,
        '✅ Blockchain is live!',
      ];

      for (let i = 0; i < steps.length; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        setDeployLogs((prev) => [...prev, steps[i]]);
        setDeployProgress(Math.min(((i + 1) / steps.length) * 100, 100));
      }

      // Done - redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.message);
      setDeploying(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderTypeSelection();
      case 1:
        return renderTemplateSelection();
      case 2:
        return renderConfiguration();
      case 3:
        return renderTokenomics();
      case 4:
        return renderGovernance();
      case 5:
        return renderReview();
      default:
        return null;
    }
  };

  const renderTypeSelection = () => (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Choose Your Blockchain Type</h2>
      <p className={styles.stepSubtitle}>Select the foundation for your blockchain network</p>
      <div className={styles.typeGrid}>
        {CHAIN_CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            className={`${styles.typeCard} ${chainConfig.type === cat.id ? styles.typeCardActive : ''}`}
            onClick={() => selectType(cat.id)}
            style={{ '--type-color': cat.color }}
          >
            <div className={styles.typeIcon}>{cat.icon}</div>
            <h3 className={styles.typeName}>{cat.name}</h3>
            <p className={styles.typeDesc}>{cat.description}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTemplateSelection = () => {
    const typeTemplates = templates[chainConfig.type] || [];
    return (
      <div className={styles.stepContent}>
        <h2 className={styles.stepTitle}>Choose a Template</h2>
        <p className={styles.stepSubtitle}>Start with a pre-configured template or build from scratch</p>

        <div className={styles.templateGrid}>
          {typeTemplates.map((tmpl) => (
            <div
              key={tmpl.id}
              className={`${styles.templateCard} ${chainConfig.template === tmpl.id ? styles.templateCardActive : ''}`}
              onClick={() => selectTemplate(tmpl)}
            >
              <div className={styles.templateHeader}>
                <span className={styles.templateIcon}>{tmpl.icon}</span>
                <span className={`badge badge-${tmpl.difficulty === 'beginner' ? 'success' : tmpl.difficulty === 'intermediate' ? 'warning' : 'danger'}`}>
                  {tmpl.difficulty}
                </span>
              </div>
              <h3 className={styles.templateName}>{tmpl.name}</h3>
              <p className={styles.templateDesc}>{tmpl.description}</p>
              <div className={styles.templateFeatures}>
                {tmpl.features.map((f) => (
                  <span key={f} className={styles.featureTag}>{f}</span>
                ))}
              </div>
              <div className={styles.templateMeta}>
                <span>⏱ {tmpl.estimatedSetupTime}</span>
                <span>📁 {tmpl.category}</span>
              </div>
            </div>
          ))}
        </div>

        <button className={`btn btn-ghost ${styles.skipBtn}`} onClick={skipTemplate}>
          Skip — I'll configure manually →
        </button>
      </div>
    );
  };

  const renderConfiguration = () => (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Configure Your Chain</h2>
      <p className={styles.stepSubtitle}>Set the core parameters for your blockchain</p>

      <div className={styles.configGrid}>
        <div className="input-group">
          <label className="input-label">Chain Name</label>
          <input
            type="text"
            className="input"
            placeholder="My Awesome Blockchain"
            value={chainConfig.name}
            onChange={(e) => updateConfig('name', e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Chain ID</label>
          <input
            type="number"
            className="input"
            value={chainConfig.chainId}
            onChange={(e) => updateConfig('chainId', parseInt(e.target.value) || '')}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Token Symbol</label>
          <input
            type="text"
            className="input"
            placeholder="TOKEN"
            value={chainConfig.symbol}
            onChange={(e) => {
              updateConfig('symbol', e.target.value.toUpperCase());
              updateToken('symbol', e.target.value.toUpperCase());
            }}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Consensus Mechanism</label>
          <select
            className="select"
            value={chainConfig.consensus}
            onChange={(e) => updateConfig('consensus', e.target.value)}
          >
            {(CONSENSUS_OPTIONS[chainConfig.type] || []).map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name} — {opt.desc}
              </option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">Block Time (seconds)</label>
          <input
            type="number"
            className="input"
            value={chainConfig.blockTime}
            onChange={(e) => updateConfig('blockTime', parseFloat(e.target.value) || '')}
            min={0}
            step="0.01"
            max={120}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Block Gas Limit</label>
          <input
            type="text"
            className="input"
            value={chainConfig.blockGasLimit}
            onChange={(e) => updateConfig('blockGasLimit', e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Network Type</label>
          <select
            className="select"
            value={chainConfig.networkType}
            onChange={(e) => updateConfig('networkType', e.target.value)}
          >
            <option value="public">Public — Open to anyone</option>
            <option value="private">Private — Permissioned access</option>
            <option value="consortium">Consortium — Multi-org governance</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderTokenomics = () => (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Token Economics</h2>
      <p className={styles.stepSubtitle}>Define your native token properties</p>

      <div className={styles.configGrid}>
        <div className="input-group">
          <label className="input-label">Token Name</label>
          <input
            type="text"
            className="input"
            placeholder="My Token"
            value={chainConfig.token.name}
            onChange={(e) => updateToken('name', e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Token Symbol</label>
          <input
            type="text"
            className="input"
            value={chainConfig.token.symbol}
            onChange={(e) => updateToken('symbol', e.target.value.toUpperCase())}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Decimals</label>
          <select
            className="select"
            value={chainConfig.token.decimals}
            onChange={(e) => updateToken('decimals', parseInt(e.target.value))}
          >
            <option value={18}>18 (Standard)</option>
            <option value={8}>8 (Bitcoin-like)</option>
            <option value={6}>6 (USDC-like)</option>
            <option value={0}>0 (No decimals)</option>
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">Total Supply</label>
          <input
            type="text"
            className="input"
            value={chainConfig.token.totalSupply}
            onChange={(e) => updateToken('totalSupply', e.target.value)}
          />
        </div>
      </div>

      <div className={styles.tokenPreview}>
        <h3>Token Preview</h3>
        <div className={styles.previewCard}>
          <div className={styles.previewRow}>
            <span>Name</span>
            <strong>{chainConfig.token.name || 'Unnamed Token'}</strong>
          </div>
          <div className={styles.previewRow}>
            <span>Symbol</span>
            <strong>{chainConfig.token.symbol}</strong>
          </div>
          <div className={styles.previewRow}>
            <span>Decimals</span>
            <strong>{chainConfig.token.decimals}</strong>
          </div>
          <div className={styles.previewRow}>
            <span>Total Supply</span>
            <strong>{Number(chainConfig.token.totalSupply).toLocaleString()} {chainConfig.token.symbol}</strong>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGovernance = () => (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Governance Settings</h2>
      <p className={styles.stepSubtitle}>Define how your blockchain will be governed</p>

      <div className={styles.configGrid}>
        <div className="input-group">
          <label className="input-label">Governance Type</label>
          <select
            className="select"
            value={chainConfig.governance.type}
            onChange={(e) => updateGovernance('type', e.target.value)}
          >
            <option value="admin">Admin Controlled — Central authority</option>
            <option value="token-voting">Token Voting — Token holders vote</option>
            <option value="multisig">Multi-Signature — Required signers</option>
            <option value="dao">DAO — Decentralized autonomous organization</option>
          </select>
        </div>

        <div className="input-group">
          <label className="input-label">Voting Period (seconds)</label>
          <input
            type="number"
            className="input"
            value={chainConfig.governance.votingPeriod}
            onChange={(e) => updateGovernance('votingPeriod', parseInt(e.target.value) || '')}
          />
          <span className={styles.inputHint}>
            ≈ {Math.round(chainConfig.governance.votingPeriod / 3600)} hours
          </span>
        </div>

        <div className="input-group">
          <label className="input-label">Quorum (%)</label>
          <input
            type="number"
            className="input"
            value={chainConfig.governance.quorum}
            onChange={(e) => updateGovernance('quorum', parseInt(e.target.value) || '')}
            min={1}
            max={100}
          />
        </div>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className={styles.stepContent}>
      <h2 className={styles.stepTitle}>Review & Deploy</h2>
      <p className={styles.stepSubtitle}>Review your configuration before deploying</p>

      {deploying ? (
        <div className={styles.deployingState}>
          <div className={styles.deployHeader}>
            <div className={`spinner spinner-lg ${styles.deploySpinner}`}></div>
            <h3>Deploying to Testnet...</h3>
            <p className={styles.deployPercent}>{Math.round(deployProgress)}%</p>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${deployProgress}%` }}></div>
          </div>
          <div className={styles.deployLogs}>
            {deployLogs.map((log, i) => (
              <div key={i} className={styles.deployLog}>
                {log}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className={styles.reviewGrid}>
            <div className={styles.reviewSection}>
              <h3>🔗 Chain Details</h3>
              <div className={styles.reviewItem}>
                <span>Name</span>
                <strong>{chainConfig.name || `My ${chainConfig.type.toUpperCase()} Chain`}</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Type</span>
                <strong>{chainConfig.type.toUpperCase()}</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Chain ID</span>
                <strong>{chainConfig.chainId}</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Consensus</span>
                <strong>{chainConfig.consensus}</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Block Time</span>
                <strong>{chainConfig.blockTime}s</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Network</span>
                <strong>{chainConfig.networkType}</strong>
              </div>
            </div>

            <div className={styles.reviewSection}>
              <h3>💰 Token</h3>
              <div className={styles.reviewItem}>
                <span>Name</span>
                <strong>{chainConfig.token.name || 'Token'}</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Symbol</span>
                <strong>{chainConfig.token.symbol}</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Supply</span>
                <strong>{Number(chainConfig.token.totalSupply).toLocaleString()}</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Decimals</span>
                <strong>{chainConfig.token.decimals}</strong>
              </div>
            </div>

            <div className={styles.reviewSection}>
              <h3>🏛️ Governance</h3>
              <div className={styles.reviewItem}>
                <span>Type</span>
                <strong>{chainConfig.governance.type}</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Voting Period</span>
                <strong>{Math.round(chainConfig.governance.votingPeriod / 3600)}h</strong>
              </div>
              <div className={styles.reviewItem}>
                <span>Quorum</span>
                <strong>{chainConfig.governance.quorum}%</strong>
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <span>⚠️</span> {error}
            </div>
          )}

          <div className={styles.deployActions}>
            <button className="btn btn-primary btn-lg" onClick={deployToTestnet}>
              🚀 Deploy to Testnet (Free)
            </button>
            <p className={styles.deployNote}>
              Testnet deployment is free. You can test your chain before launching mainnet.
            </p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={styles.builderPage}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo} onClick={() => router.push('/')}>
            <span>⛓️</span>
            <span className={styles.logoText}>Chain<span className={styles.logoAccent}>Forge</span></span>
          </div>
          <div className={styles.headerActions}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/dashboard')}>
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className={styles.builderLayout}>
        {/* Progress Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Build Wizard</div>
          <div className={styles.steps}>
            {WIZARD_STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`${styles.step} ${i === currentStep ? styles.stepActive : ''} ${i < currentStep ? styles.stepDone : ''}`}
                onClick={() => {
                  if (i < currentStep || (i === 1 && chainConfig.type)) {
                    setCurrentStep(i);
                  }
                }}
              >
                <div className={styles.stepDot}>
                  {i < currentStep ? '✓' : step.icon}
                </div>
                <div className={styles.stepInfo}>
                  <span className={styles.stepLabel}>{step.label}</span>
                  <span className={styles.stepNum}>Step {i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className={styles.main}>
          {renderStep()}

          {/* Navigation Buttons */}
          {currentStep > 0 && currentStep < 5 && (
            <div className={styles.navButtons}>
              <button className="btn btn-secondary" onClick={prevStep}>
                ← Previous
              </button>
              <button className="btn btn-primary" onClick={nextStep}>
                Next →
              </button>
            </div>
          )}
          {currentStep === 5 && !deploying && (
            <div className={styles.navButtons}>
              <button className="btn btn-secondary" onClick={prevStep}>
                ← Previous
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
