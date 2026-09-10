import { useEffect, useId, useRef } from 'react';
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

  // Unique per hook instance. supabase-js reuses a channel by its topic string,
  // and calling `.on()` on an already-`subscribe()`d channel throws — which
  // happens if two components subscribe to the same table at once. A unique
  // topic gives each instance its own channel.
  const instanceId = useId();

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    const channel = supabase
      .channel(`realtime:${table}:${instanceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, fire)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [table, enabled, debounceMs, instanceId]);
}
