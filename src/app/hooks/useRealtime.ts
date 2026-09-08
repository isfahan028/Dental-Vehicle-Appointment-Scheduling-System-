import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Subscribe to Postgres change events on a table and run `onChange` whenever a
 * row is inserted, updated or deleted. Multiple events that arrive close
 * together are collapsed into a single call (trailing debounce), so a burst of
 * writes triggers just one refetch.
 *
 * The table must be part of the `supabase_realtime` publication and readable by
 * the `anon` role (see migration 04).
 */
export function useRealtimeRefetch(
  table: string,
  onChange: () => void,
  { enabled = true, debounceMs = 300 }: { enabled?: boolean; debounceMs?: number } = {},
) {
  // Keep the latest callback without forcing the subscription effect to re-run.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, fire)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [table, enabled, debounceMs]);
}
