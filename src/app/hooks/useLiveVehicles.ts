import { useCallback, useEffect, useState } from 'react';
import * as api from '../lib/api';
import type { LiveVehicle } from '../types';
import { usePolling } from './usePolling';

/**
 * Live camera vehicles from the V-Track cloud, refreshed every 30s (also keeps
 * the jsession inside each playerUrl fresh). Kept out of the dashboard's
 * loadAll so a camera-platform outage never shows up as a dashboard-wide
 * "failed to load" error — callers show `error` in their own spot instead.
 */
export function useLiveVehicles(accessToken: string | null, { enabled = true } = {}) {
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setIsRefreshing(true);
    try {
      setVehicles(await api.getLiveVehicles(accessToken));
      setError(null);
    } catch (err) {
      console.error('Failed to load live vehicles:', err);
      setError(err instanceof Error ? err.message : 'Failed to load live vehicles');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  usePolling(reload, { intervalMs: 30_000, enabled });

  const onlineCount = vehicles.filter(v => v.online).length;

  return { vehicles, onlineCount, error, isLoading, isRefreshing, reload };
}
