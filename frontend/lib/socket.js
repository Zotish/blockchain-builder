'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ||
  'http://localhost:5001';

let sharedSocket = null;
let refCount = 0;

function getSocket() {
  if (!sharedSocket || !sharedSocket.connected) {
    sharedSocket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
  }
  return sharedSocket;
}

/**
 * Hook: subscribe to real-time chain stats
 * @param {string|null} chainId   - MongoDB ObjectId string
 * @param {function}    onStats   - callback({ blockHeight, txCount, peers, gasPrice, lastSeen })
 */
export function useChainStats(chainId, onStats) {
  const onStatsRef = useRef(onStats);
  onStatsRef.current = onStats;

  useEffect(() => {
    if (!chainId) return;
    const socket = getSocket();
    refCount++;

    const handleStats = (data) => {
      if (data.chainId === chainId) {
        onStatsRef.current(data.stats);
      }
    };

    socket.emit('subscribe:chain', chainId);
    socket.on('chain:stats', handleStats);

    return () => {
      socket.off('chain:stats', handleStats);
      socket.emit('unsubscribe:chain', chainId);
      refCount--;
    };
  }, [chainId]);
}

/**
 * Hook: subscribe to deployment progress
 * @param {string|null} deploymentId
 * @param {object} handlers  - { onUpdate, onComplete, onFailed }
 */
export function useDeploymentProgress(deploymentId, handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!deploymentId) return;
    const socket = getSocket();

    socket.emit('subscribe:deployment', deploymentId);

    const onUpdate = (data) => handlersRef.current.onUpdate?.(data);
    const onComplete = (data) => handlersRef.current.onComplete?.(data);
    const onFailed = (data) => handlersRef.current.onFailed?.(data);

    socket.on('deployment:update', onUpdate);
    socket.on('deployment:complete', onComplete);
    socket.on('deployment:failed', onFailed);

    return () => {
      socket.off('deployment:update', onUpdate);
      socket.off('deployment:complete', onComplete);
      socket.off('deployment:failed', onFailed);
    };
  }, [deploymentId]);
}

/**
 * Get the shared socket instance (for manual use)
 */
export function getSharedSocket() {
  return getSocket();
}
