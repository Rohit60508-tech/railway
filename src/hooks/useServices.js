/**
 * useServices.js
 * Custom Hook abstracting health status monitoring for Node Gateway (:5000) and Python AI Service (:5001)
 */

import { useState, useEffect, useCallback } from 'react';
import { gateway, aiService } from '../services/client';

export function useServiceHealth() {
  const [status, setStatus] = useState({ gateway: 'checking', ai: 'checking' });

  const checkHealth = useCallback(async () => {
    try {
      await gateway.health();
      setStatus((s) => ({ ...s, gateway: 'online' }));
    } catch {
      setStatus((s) => ({ ...s, gateway: 'offline' }));
    }

    try {
      await aiService.health();
      setStatus((s) => ({ ...s, ai: 'online' }));
    } catch {
      setStatus((s) => ({ ...s, ai: 'offline' }));
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return { status, checkHealth };
}
