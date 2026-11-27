// Reverse proxy that lets the V-Track live player run inside an https page.
//
// The V-Track cloud is http-only: the player page is http, and the video
// itself arrives over a plain ws:// WebSocket on a separate port. Browsers
// block both inside an https page (mixed content), and Vercel can't proxy
// WebSockets. This proxy sits behind something that terminates TLS (a
// Cloudflare Tunnel, Caddy, nginx...) and forwards everything to V-Track:
//
//   https://<proxy>/808gps/...        -> http://VTRACK_HOST:80/808gps/...
//   https://<proxy>/16605/3/1?...     -> http://VTRACK_HOST:6605/3/1?...
//   wss://<proxy>/16604/...           -> ws://VTRACK_HOST:6604/...
//
// It relies on the player's own "singleHttpsPort=1" mode, where every media
// port P is addressed as https://host/<P+10000>/... instead of host:P. The
// one thing the player can't be told is where the video WebSocket lives —
// V-Track's address reply says ws://<its own IP>:<port> — so we rewrite
// that JSON reply to point at this proxy over wss.
//
// No dependencies; Node 18+.  Env: PORT (default 8787), VTRACK_HOST.

import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PORT) || 8787;
const VTRACK_HOST = process.env.VTRACK_HOST || '103.233.193.79';
const PORT_OFFSET = 10000; // the player's https port mapping: P -> P + 10000
// Only V-Track's media ports may be reached through the /<port>/ prefix.
const isMediaPort = (p) => p >= 6600 && p <= 6699;

// "/16605/3/1?x" -> { port: 6605, path: "/3/1?x" }; anything else -> port 80.
function route(url) {
  const m = /^\/(\d{5})(?=[/?]|$)(.*)$/.exec(url);
  if (m) {
    const port = Number(m[1]) - PORT_OFFSET;
    if (isMediaPort(port)) {
      const rest = m[2] || '/';
      return { port, path: rest.startsWith('/') ? rest : `/${rest}` };
    }
  }
  return { port: 80, path: url };
}

// The host name the browser used to reach us (behind a tunnel, Host is ours).
function publicHostname(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  return String(host).split(',')[0].trim().replace(/:\d+$/, '');
}

function upstreamHeaders(req, port, { dropEncoding = false } = {}) {
  const headers = { ...req.headers, host: port === 80 ? VTRACK_HOST : `${VTRACK_HOST}:${port}` };
  delete headers['x-forwarded-host'];
  delete headers['x-forwarded-proto'];
  delete headers['x-forwarded-for'];
  delete headers['cf-connecting-ip'];
  if (dropEncoding) delete headers['accept-encoding']; // we need plain JSON to rewrite
  return headers;
}

// The media server's address reply: { result:0, server:{ clientIp, clientPort, ... }, IsHttps? }.
// Point it at us over wss; the player then connects to wss://<us>/<clientPort+10000>.
function rewriteAddressReply(body, hostname) {
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    return body;
  }
  if (json && json.result === 0 && json.server) {
    json.IsHttps = 1;
    delete json.HttpsMapPort; // default mapping = port + 10000, which route() undoes
    json.server.clientIp = hostname;
    json.server.clientIp2 = hostname;
    json.server.clientIp3 = hostname;
    json.server.lanip = hostname;
  }
  return JSON.stringify(json);
}

const server = http.createServer((req, res) => {
  const { port, path } = route(req.url || '/');
  const rewrite = port !== 80 && path.startsWith('/3/');
  const started = Date.now();

  const upstream = http.request(
    { host: VTRACK_HOST, port, path, method: req.method, headers: upstreamHeaders(req, port, { dropEncoding: rewrite }) },
    (up) => {
      const headers = { ...up.headers };
      // Keep redirects on our host.
      if (headers.location) headers.location = headers.location.replace(/^https?:\/\/[^/]+/i, '');

      if (!rewrite) {
        res.writeHead(up.statusCode || 502, headers);
        up.pipe(res);
        up.on('end', () => console.log(`${req.method} ${req.url} -> :${port} ${up.statusCode} ${Date.now() - started}ms`));
        return;
      }

      const chunks = [];
      up.on('data', (c) => chunks.push(c));
      up.on('end', () => {
        const body = rewriteAddressReply(Buffer.concat(chunks).toString('utf8'), publicHostname(req));
        delete headers['content-length'];
        delete headers['transfer-encoding'];
        res.writeHead(up.statusCode || 502, { ...headers, 'content-length': Buffer.byteLength(body) });
        res.end(body);
        console.log(`${req.method} ${req.url} -> :${port} ${up.statusCode} (address reply rewritten: ${body.slice(0, 160)})`);
      });
    },
  );
  upstream.on('error', (err) => {
    console.error(`upstream error ${req.url}: ${err.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Bad gateway');
  });
  req.pipe(upstream);
});

// V-Track's media server matches header NAMES case-sensitively: sent
// "upgrade: websocket" (how Node and cloudflared hand them to us) it ignores
// the upgrade and answers with a plain HTTP FLV stream, so the browser's
// WebSocket fails. Re-case every name: "sec-websocket-key" -> "Sec-WebSocket-Key".
const HEADER_CASE = { 'sec-websocket-key': 'Sec-WebSocket-Key', 'sec-websocket-version': 'Sec-WebSocket-Version',
  'sec-websocket-extensions': 'Sec-WebSocket-Extensions', 'sec-websocket-protocol': 'Sec-WebSocket-Protocol' };
const canonicalHeader = (name) =>
  HEADER_CASE[name.toLowerCase()] ?? name.toLowerCase().replace(/(^|-)([a-z])/g, (_, dash, c) => dash + c.toUpperCase());

// WebSocket (the actual video): open a raw TCP connection to the media port,
// replay the upgrade request with the path/host rewritten, then pipe bytes.
server.on('upgrade', (req, socket, head) => {
  const { port, path } = route(req.url || '/');
  if (port === 80) {
    socket.destroy();
    return;
  }
  const upstream = net.connect(port, VTRACK_HOST, () => {
    const headers = upstreamHeaders(req, port);
    const lines = [`${req.method} ${path} HTTP/1.1`];
    for (const [k, v] of Object.entries(headers)) {
      for (const val of Array.isArray(v) ? v : [v]) lines.push(`${canonicalHeader(k)}: ${val}`);
    }
    upstream.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
    console.log(`WS ${req.url} -> :${port}${path}`);
  });
  const close = () => {
    socket.destroy();
    upstream.destroy();
  };
  upstream.on('error', (err) => {
    console.error(`ws upstream error ${req.url}: ${err.message}`);
    close();
  });
  socket.on('error', close);
  upstream.on('close', close);
  socket.on('close', close);
});

server.listen(PORT, () => {
  console.log(`V-Track proxy on http://localhost:${PORT} -> ${VTRACK_HOST}`);
});
