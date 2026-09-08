import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// Browser-side Supabase client.
//
// This is used ONLY for Realtime subscriptions (listening for Postgres changes).
// All reads and writes still go through the Hono edge function in `lib/api.ts`,
// which authenticates requests with the custom session token and enforces
// per-user / admin access rules that Postgres RLS cannot express here.
//
// Because this client carries only the public anon key, the database must not
// expose anything sensitive to the `anon` role — see
// `supabase/migrations/04_realtime_and_rls.sql`.
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 5 } },
  },
);
