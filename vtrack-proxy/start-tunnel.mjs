// One command to put live video on the https site:  npm run tunnel
//
//   1. starts the reverse proxy (server.mjs) on localhost:8787
//   2. starts a Cloudflare quick tunnel to it and reads its new https URL
//   3. waits until that URL actually answers
//   4. sets the VTRACK_PLAYER_BASE secret to it (Monitor page embeds video)
//
// Ctrl+C (or cloudflared dying) unsets the secret again, so the site falls
// back to the "open in new tab" player instead of pointing at a dead tunnel.
//
// Needs cloudflared (winget install --id Cloudflare.cloudflared) and a
// Supabase CLI login. DRY_RUN=1 skips touching the secret.

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 8787;
const DRY_RUN = process.env.DRY_RUN === '1';
const SECRET = 'VTRACK_PLAYER_BASE';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const say = (msg) => console.log(`\n[tunnel] ${msg}`);

function supabaseSecret(args) {
  if (DRY_RUN) {
    say(`DRY_RUN: would run "supabase secrets ${args.join(' ')}"`);
    return true;
  }
  // --yes answers the CLI's "Set/Unset 1 secret on project ... production?" prompt.
  const r = spawnSync('npx', ['--yes', 'supabase', 'secrets', ...args, '--yes'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });
  return r.status === 0;
}

async function waitUntilReachable(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/808gps/open/player/video.html`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return true;
    } catch {
      // DNS for a brand-new quick tunnel can take a little while.
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return false;
}

process.env.PORT = String(PORT);
await import('./server.mjs');

say('Starting Cloudflare tunnel…');
const cf = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });

let secretSet = false;
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (secretSet) {
    say(`Unsetting ${SECRET} — the site goes back to the new-tab player.`);
    if (!supabaseSecret(['unset', SECRET])) {
      say(`⚠️  Could not unset it. Run:  npx supabase secrets unset ${SECRET}`);
    }
  }
  cf.kill();
  process.exit(code);
}

cf.on('error', (err) => {
  if (err.code === 'ENOENT') {
    say('cloudflared is not installed. Install it with:\n  winget install --id Cloudflare.cloudflared\nthen open a NEW PowerShell window and run  npm run tunnel  again.');
  } else {
    say(`cloudflared failed to start: ${err.message}`);
  }
  shutdown(1);
});

cf.on('exit', (code) => {
  if (!shuttingDown) {
    say(`cloudflared stopped (exit ${code}).`);
    shutdown(1);
  }
});

let urlSeen = false;
const onOutput = async (chunk) => {
  if (urlSeen) return;
  const match = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString());
  if (!match) return;
  urlSeen = true;
  const url = match[0];

  say(`Tunnel URL: ${url}\n[tunnel] Waiting for it to come online…`);
  if (!(await waitUntilReachable(url))) {
    say('The tunnel never became reachable. Stopping — try  npm run tunnel  again.');
    shutdown(1);
    return;
  }

  say(`Setting ${SECRET}=${url}`);
  if (!supabaseSecret(['set', `${SECRET}=${url}`])) {
    say('Setting the secret failed (logged in to the Supabase CLI?). Stopping.');
    shutdown(1);
    return;
  }
  secretSet = !DRY_RUN;

  console.log([
    '',
    '==============================================================',
    '  ✅ READY — live video now embeds on the https site (Monitor)',
    `     ${url}`,
    '  Keep this window open. Press Ctrl+C to stop and clean up.',
    '==============================================================',
    '',
  ].join('\n'));
};
cf.stdout.on('data', onOutput);
cf.stderr.on('data', onOutput);

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
