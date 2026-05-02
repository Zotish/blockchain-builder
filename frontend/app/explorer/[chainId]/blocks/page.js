'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import styles from '../public-explorer.module.css';

export default function ViewAllBlocksPage() {
  const params = useParams();
  const router = useRouter();
  const { chainId } = params;

  const [chain, setChain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState([]);
  const [stats, setStats] = useState({ blockHeight: 0 });

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.getPublicChain(chainId);
        if (res.success) {
          setChain(res.data.chain);
        }
      } catch (err) {
        console.error('Failed to load chain:', err);
      } finally {
        setLoading(false);
      }
    }
    if (chainId) loadData();
  }, [chainId]);

  useEffect(() => {
    if (!chain || !chain.endpoints?.rpc) return;

    const rpcUrl = process.env.NEXT_PUBLIC_API_URL 
      ? `${process.env.NEXT_PUBLIC_API_URL}/rpc/${chain._id}`
      : `${window.location.origin}/api/rpc/${chain._id}`;

    const normalizeBlock = (b, type) => {
      if (type === 'substrate') {
        return {
          number: parseInt(b.block.header.number, 16) || b.block.header.number,
          hash: b.block.header.parentHash,
          timestamp: Date.now(),
          miner: 'Validator',
          txCount: b.block.extrinsics?.length || 0,
          gasUsed: '0', gasLimit: '0'
        };
      }
      if (type === 'cosmos') {
        return {
          number: parseInt(b.block.header.height),
          hash: b.block_id.hash,
          timestamp: b.block.header.time,
          miner: b.block.header.proposer_address,
          txCount: b.block.data.txs?.length || 0,
          gasUsed: '0', gasLimit: '0'
        };
      }
      if (type === 'solana') {
        return {
          number: b.slot || b.number,
          hash: b.blockhash || '...',
          timestamp: (b.blockTime * 1000) || Date.now(),
          miner: 'Leader',
          txCount: b.transactions?.length || 0,
          gasUsed: '0', gasLimit: '0'
        };
      }
      return {
        number: parseInt(b.number, 16),
        hash: b.hash,
        timestamp: parseInt(b.timestamp, 16) * 1000,
        miner: b.miner,
        txCount: b.transactions?.length || 0,
        gasUsed: parseInt(b.gasUsed, 16),
        gasLimit: parseInt(b.gasLimit, 16)
      };
    };

    const fetchBlocks = async () => {
      try {
        let latestNum = 0;
        const chainType = chain.type || 'evm';

        // 1. Get latest height
        if (chainType === 'substrate') {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'chain_getHeader', params: [], id: 1 })
          });
          const data = await res.json();
          if (data.result) latestNum = parseInt(data.result.number, 16);
        } else if (chainType === 'cosmos') {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'status', params: [], id: 1 })
          });
          const data = await res.json();
          if (data.result) latestNum = parseInt(data.result.sync_info.latest_block_height);
        } else {
          const res = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
          });
          const data = await res.json();
          if (data.result) latestNum = parseInt(data.result, 16);
        }

        if (!latestNum) return;
        setStats({ blockHeight: latestNum });

        // 2. Fetch last 25 blocks
        const blockPromises = [];
        const count = 25;

        if (chainType === 'evm' || chainType === 'hyperledger' || chainType === 'custom') {
          for (let i = latestNum; i > Math.max(-1, latestNum - count); i--) {
            blockPromises.push(
              fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBlockByNumber', params: ['0x' + i.toString(16), false], id: i })
              }).then(r => r.json()).then(d => d.result)
            );
          }
        } else if (chainType === 'cosmos') {
          for (let i = latestNum; i > Math.max(0, latestNum - count); i--) {
            blockPromises.push(
              fetch(`${rpcUrl}/block?height=${i}`).then(r => r.json()).then(d => d.result)
            );
          }
        } else if (chainType === 'solana') {
          const slotsRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'getBlocks', params: [Math.max(0, latestNum - 40), latestNum], id: 1 })
          }).then(r => r.json());
          
          if (slotsRes.result) {
            const slots = slotsRes.result.slice(-count).reverse();
            for (const slot of slots) {
              blockPromises.push(
                fetch(rpcUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ jsonrpc: '2.0', method: 'getBlock', params: [slot, { encoding: 'json', transactionDetails: 'signatures' }], id: slot })
                }).then(r => r.json()).then(d => d.result ? { ...d.result, slot } : null)
              );
            }
          }
        } else if (chainType === 'substrate') {
          for (let i = 0; i < count; i++) {
            const blockNum = latestNum - i;
            if (blockNum < 0) break;
            blockPromises.push(
              fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'chain_getBlockHash', params: [blockNum], id: i })
              }).then(r => r.json())
                .then(d => d.result 
                  ? fetch(rpcUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ jsonrpc: '2.0', method: 'chain_getBlock', params: [d.result], id: i })
                    }).then(r => r.json()).then(inner => inner.result)
                  : null
                )
            );
          }
        }

        const results = await Promise.all(blockPromises);
        const validBlocks = results.filter(Boolean).map(b => normalizeBlock(b, chainType));
        setBlocks(validBlocks);
      } catch (err) {
        console.warn('Failed to fetch blocks:', err);
      }
    };

    fetchBlocks();
    const interval = setInterval(fetchBlocks, 10000);
    return () => clearInterval(interval);
  }, [chain]);

  const truncateAddr = (addr) => addr ? `${addr.slice(0, 10)}...${addr.slice(-8)}` : 'Unknown';
  
  const timeAgo = (ts) => {
    if (!ts) return '';
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    return `${Math.floor(s/3600)}h ago`;
  };

  if (loading) return <div className={styles.loadingContainer}><div className={styles.spinner}></div></div>;
  if (!chain) return <div className={styles.errorContainer}><h2>Chain not found</h2></div>;

  return (
    <div className={styles.explorerPage}>
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <div className={styles.brand} onClick={() => router.push(`/explorer/${chainId}`)}>
            <div className={styles.logoIcon}>⛓️</div>
            <div className={styles.brandName}>{chain.name} <span className={styles.scanText}>Scan</span></div>
          </div>
        </div>
      </header>

      <main className={styles.contentSection} style={{ marginTop: '2rem' }}>
        <div className={styles.tableTitleSection}>
          <h2>Blocks</h2>
          <div className={styles.subText}>Showing the latest {blocks.length} blocks</div>
        </div>

        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.explorerTable}>
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Age</th>
                  <th>Txns</th>
                  <th>Validator / Miner</th>
                  <th>Gas Used</th>
                  <th>Gas Limit</th>
                </tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.hash}>
                    <td><span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/block/${block.number}`)}>{block.number}</span></td>
                    <td>{timeAgo(block.timestamp)}</td>
                    <td>{block.txCount}</td>
                    <td><span className={styles.primaryLink} onClick={() => router.push(`/explorer/${chainId}/address/${block.miner}`)}>{truncateAddr(block.miner)}</span></td>
                    <td>{block.gasUsed.toLocaleString()}</td>
                    <td>{block.gasLimit.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {blocks.length === 0 && <div className={styles.emptyState}>No blocks found.</div>}
        </div>
      </main>

      <footer className={styles.footer}>Powered by ChainForge Infrastructure</footer>
    </div>
  );
}
