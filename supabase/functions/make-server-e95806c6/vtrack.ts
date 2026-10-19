// Client for the V-Track / CMSV6 vehicle-video cloud (JT/T 808 + 1078), the
// platform the professor's team runs for live camera feeds from the vehicles.
// Credentials live only in Supabase secrets — the browser never sees them; it
// only ever receives a short-lived jsession inside the player URL.
//
// Secrets:
//   VTRACK_BASE  platform base URL  (default http://103.233.193.79)
//   VTRACK_USER  account name
//   VTRACK_PASS  account password
//
// Why the player is opened in a new tab instead of embedded: the platform is
// http-only and its player streams over a plain ws:// WebSocket on a separate
// port, so an https page (Vercel) can neither iframe it nor proxy it.

const BASE = (Deno.env.get('VTRACK_BASE') || 'http://103.233.193.79').replace(/\/+$/, '');
const USER = Deno.env.get('VTRACK_USER');
const PASS = Deno.env.get('VTRACK_PASS');

const REQUEST_TIMEOUT_MS = 10_000;

// From the API doc's error-code table — turns a bare number into something readable.
const ERRORS: Record<number, string> = {
  1: 'username or password incorrect',
  2: 'username or password incorrect',
  3: 'user disabled',
  4: 'user expired',
  5: 'session expired',
  6: 'system exception',
  7: 'request parameter incorrect',
  13: 'no operating authority',
};

export class VtrackNotConfiguredError extends Error {}

export interface VtrackVehicle {
  id: string;
  name: string;
  deviceNo: string | null;
  channelCount: number;
  online: boolean;
  playerUrl: string | null; // only set for online vehicles with a device
}

// Re-use one login per edge-function instance; re-login proactively before the
// ~30 min server session lapses, and reactively if a call returns result:5.
let sessionCache: { jsession: string | null; at: number } = { jsession: null, at: 0 };
const SESSION_TTL_MS = 25 * 60 * 1000;

export function isConfigured() {
  return !!USER && !!PASS;
}

async function rawGet(action: string, params: Record<string, string | undefined>) {
  const url = new URL(`${BASE}/StandardApiAction_${action}.action`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${action}: HTTP ${res.status}`);
  return res.json();
}

async function login(): Promise<string> {
  if (!isConfigured()) {
    throw new VtrackNotConfiguredError('VTRACK_USER / VTRACK_PASS secrets are not set');
  }
  const json = await rawGet('login', { account: USER, password: PASS });
  if (json.result !== 0 || !json.jsession) {
    throw new Error(`V-Track login failed: result=${json.result} (${ERRORS[json.result] || 'see API doc'})`);
  }
  sessionCache = { jsession: json.jsession, at: Date.now() };
  return json.jsession;
}

async function getSession(): Promise<string> {
  if (sessionCache.jsession && Date.now() - sessionCache.at < SESSION_TTL_MS) {
    return sessionCache.jsession;
  }
  return login();
}

// Call an authenticated action; if the session expired mid-flight, re-login once and retry.
async function authedGet(action: string, params: Record<string, string | undefined>) {
  let jsession = await getSession();
  let json = await rawGet(action, { ...params, jsession });
  if (json.result === 5) {
    jsession = await login();
    json = await rawGet(action, { ...params, jsession });
  }
  if (json.result !== 0) {
    throw new Error(`V-Track ${action} failed: result=${json.result} (${ERRORS[json.result] || 'see API doc'})`);
  }
  return { json, jsession };
}

// The platform's ready-made live player for one device. View-only: never pass
// talkback/mic params (professor's instruction).
function buildPlayerUrl(deviceNo: string, jsession: string) {
  const url = new URL(`${BASE}/808gps/open/player/video.html`);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('devIdno', deviceNo);
  url.searchParams.set('sessid', jsession);
  return url.toString();
}

// Every vehicle the account can see, with a live online flag and (if online)
// a ready-to-open player URL.
export async function getVehicles(): Promise<VtrackVehicle[]> {
  const [veh, ol] = await Promise.all([
    authedGet('queryUserVehicle', { language: 'en' }),
    authedGet('getDeviceOlStatus', {}),
  ]);
  const onlineByDev = new Map<string, boolean>(
    (ol.json.onlines || []).map((o: { did: string; online: number }) => [String(o.did), o.online === 1]),
  );

  // deno-lint-ignore no-explicit-any
  return (veh.json.vehicles || []).map((v: any) => {
    const dev = (v.dl || [])[0] || {};
    const deviceNo = dev.id != null ? String(dev.id) : null;
    const online = deviceNo ? onlineByDev.get(deviceNo) ?? false : false;
    return {
      id: String(v.id),
      name: v.nm,
      deviceNo,
      channelCount: dev.cc ?? 0,
      online,
      playerUrl: deviceNo && online ? buildPlayerUrl(deviceNo, veh.jsession) : null,
    };
  });
}
