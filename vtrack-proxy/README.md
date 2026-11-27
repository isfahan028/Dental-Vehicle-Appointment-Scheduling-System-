# V-Track reverse proxy

Lets the V-Track live video player run **inside the https site** (the Monitor
page and the Live tab), instead of only in a new http tab.

## Why it's needed

The V-Track camera cloud (`103.233.193.79`) only speaks plain **http**, and
the video itself streams over a plain **ws://** WebSocket on another port.
Browsers block both inside an https page ("mixed content"), V-Track can't
enable https on its side, and Vercel can't proxy WebSockets. So a small
always-on proxy with https in front of it sits in between:

```
browser ──https / wss──► TLS (Cloudflare Tunnel, Caddy, nginx…) ──► this proxy ──http / ws──► V-Track
```

| Browser asks for | Proxy forwards to |
|---|---|
| `https://<proxy>/808gps/...` | `http://103.233.193.79:80/808gps/...` |
| `https://<proxy>/16605/3/1?...` | `http://103.233.193.79:6605/3/1?...` (address reply rewritten) |
| `wss://<proxy>/16604/3/3?...` | `ws://103.233.193.79:6604/3/3?...` (the video) |

It relies on the player's own `singleHttpsPort=1` mode (media port `P` is
addressed as `https://host/<P+10000>/...`). Two V-Track quirks it handles:

1. The address reply says "connect to `ws://103.233.193.79:<port>`". The proxy
   rewrites it to `IsHttps=1` + our host name so the player uses `wss://` to us.
2. The media server matches header names **case-sensitively** — it ignores
   `upgrade: websocket` (lowercase) and sends plain FLV instead, which breaks
   the browser's WebSocket. The proxy re-cases headers (`Upgrade`, `Sec-WebSocket-Key`…).

## Run it

Needs Node 18+, no `npm install`.

```bash
node vtrack-proxy/server.mjs
```

Env: `PORT` (default `8787`), `VTRACK_HOST` (default `103.233.193.79`).

### Quick test with a temporary https URL (Cloudflare quick tunnel)

```bash
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:8787
```

It prints a `https://<random>.trycloudflare.com` URL. **The URL changes every
time cloudflared restarts** and it only works while this PC is on — fine for
a demo, not for production.

## Hook it up to the site

Set the edge-function secret to the proxy's https URL (no trailing slash), then
the Live tab and Monitor page get player links through the proxy, with
`singleHttpsPort=1`, and the Monitor embeds the video on the https site:

```bash
npx supabase secrets set VTRACK_PLAYER_BASE=https://<your-proxy-host>
```

No redeploy is needed after changing a secret. To go back to the direct http
player, unset it:

```bash
npx supabase secrets unset VTRACK_PLAYER_BASE
```

## For production

Run this on an always-on machine (a university server or a small VPS) behind
a real https endpoint with a fixed name, e.g. a named Cloudflare Tunnel on our
own domain, or Caddy (automatic Let's Encrypt). Only V-Track's media ports
6600–6699 are reachable through the `/<port>/` prefix; viewing still needs a
valid V-Track session id.
