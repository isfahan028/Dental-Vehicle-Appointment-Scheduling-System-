import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import * as api from '../../lib/api';
import type { LoginHistoryEntry, LoginReason } from '../../types';
import { Button } from '../ui/Button';
import { usePolling } from '../../hooks/usePolling';

const RESULT_FILTERS = ['All', 'Success', 'Failed'] as const;
type ResultFilter = (typeof RESULT_FILTERS)[number];

const REASON_BADGES: Record<LoginReason, { label: string; className: string }> = {
  success: { label: 'Success', className: 'bg-green-100 text-green-800' },
  wrong_password: { label: 'Wrong password', className: 'bg-red-100 text-red-800' },
  locked: { label: 'Locked (too many tries)', className: 'bg-orange-100 text-orange-800' },
  deactivated: { label: 'Account deactivated', className: 'bg-gray-200 text-gray-700' },
  no_profile: { label: 'No profile', className: 'bg-gray-200 text-gray-700' },
};

// "Chrome on Windows"-style summary of a user-agent string. Order matters:
// Edge and Opera UAs also contain "Chrome", and Chrome's contains "Safari".
function describeDevice(ua: string | null): string {
  if (!ua) return '—';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /curl|node|deno|python/i.test(ua) ? 'Script/tool'
    : 'Other';
  const os =
    /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  return os ? `${browser} on ${os}` : browser;
}

// Admin audit log of every sign-in attempt (migration 11). Loads on its own
// when the tab is opened rather than in the dashboard's loadAll.
export function LoginsTab({ accessToken }: { accessToken: string }) {
  const [history, setHistory] = useState<LoginHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<ResultFilter>('All');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setHistory(await api.getLoginHistory(accessToken));
      setError(null);
    } catch (err) {
      console.error('Failed to load login history:', err);
      setError(err instanceof Error ? err.message : 'Failed to load login history');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, { intervalMs: 30_000 });

  const last24h = useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const recent = history.filter(h => new Date(h.created_at).getTime() >= since);
    return { ok: recent.filter(h => h.success).length, failed: recent.filter(h => !h.success).length };
  }, [history]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history
      .filter(h => filter === 'All' || (filter === 'Success') === h.success)
      .filter(h =>
        !q ||
        h.email.includes(q) ||
        (h.user_name ?? '').toLowerCase().includes(q) ||
        (h.ip_address ?? '').includes(q),
      );
  }, [history, filter, search]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">
              Login History
              <span className="ml-2 text-sm font-normal text-gray-400">
                Showing {visible.length} of {history.length}
              </span>
            </h3>
            <p className="text-sm text-gray-500">
              Last 24 hours:{' '}
              <span className="text-green-700 font-medium">{last24h.ok} successful</span>
              {' · '}
              <span className={last24h.failed > 0 ? 'text-red-700 font-medium' : ''}>{last24h.failed} failed</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={isRefreshing} className="gap-1.5 self-start sm:self-auto">
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-gray-100 p-1 rounded-lg self-start">
            {RESULT_FILTERS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  filter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email or IP…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="m-6 flex items-start gap-2 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visible.map(h => {
              const badge = REASON_BADGES[h.reason] ?? REASON_BADGES.wrong_password;
              return (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {new Date(h.created_at).toLocaleString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="font-medium text-gray-900">{h.user_name ?? <span className="text-gray-400 italic">Unknown</span>}</div>
                    <div className="text-gray-500">{h.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{h.ip_address ?? '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" title={h.user_agent ?? ''}>
                    {describeDevice(h.user_agent)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isLoading && !error && visible.length === 0 && (
        <p className="text-center text-gray-500 py-12">
          {history.length === 0 ? 'No sign-ins recorded yet.' : 'No sign-ins match this filter.'}
        </p>
      )}
      {isLoading && <p className="text-center text-gray-500 py-12">Loading login history…</p>}
    </div>
  );
}
