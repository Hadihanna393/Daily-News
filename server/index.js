// Dependency-free static + API server for Daily Digest.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildDigest, digestSnapshot, listArchive, readSnapshot, CONFIG, dayKey } from './digest.js';
import { TOPICS } from './feeds.js';
import { buildBrief, briefHeadline } from './brief.js';
import { briefToHTML, briefFilename } from './brief-html.js';
import { PushService } from './push.js';
import { DailyTask } from './schedule.js';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';

const BRIEF_HOUR = Number(process.env.BRIEF_HOUR || 7);
const BRIEF_MINUTE = Number(process.env.BRIEF_MINUTE || 0);
const BRIEF_TZ = process.env.BRIEF_TZ || 'Asia/Jerusalem';

const push = new PushService(CONFIG.dataDir);

/*
 * Shared secret for the send webhook. On a host that sleeps when idle, an
 * external cron service calls that webhook to wake the app and fire the morning
 * briefing. Without a secret anyone who guessed the URL could push to every
 * subscriber, so the endpoint is disabled entirely unless one is configured.
 */
const BRIEF_SEND_KEY = process.env.BRIEF_SEND_KEY || '';

/** Constant-time compare, so the secret cannot be guessed a character at a time. */
function secretMatches(given) {
  if (!BRIEF_SEND_KEY || !given) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(BRIEF_SEND_KEY);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const morningBriefing = new DailyTask({
  hour: BRIEF_HOUR,
  minute: BRIEF_MINUTE,
  timeZone: BRIEF_TZ,
  run: async () => {
    // Rebuild first so the notification reflects the actual morning, not a
    // digest cached overnight.
    await buildDigest({ force: true });
    const result = await push.sendAll({ urgency: 'high' });
    console.log(
      `[brief] morning push -> ${result.sent} delivered, ${result.failed} failed, ${result.removed} expired`
    );
    return { ...result, at: new Date().toISOString() };
  }
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function readJson(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Body was not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ...extraHeaders
  });
  res.end(payload);
}

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';

  // Contain everything under public/.
  const target = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!target.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(target);
    const ext = path.extname(target).toLowerCase();
    const immutable = /\/icons\//.test(rel) || ext === '.woff2';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=604800' : 'no-cache'
    });
    res.end(data);
  } catch {
    // SPA fallback so deep links still open the app.
    if (!path.extname(rel)) {
      try {
        const html = await fs.readFile(path.join(PUBLIC_DIR, 'index.html'));
        res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
        res.end(html);
        return;
      } catch {}
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = url;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS'
    });
    return res.end();
  }

  try {
    if (pathname === '/api/topics') {
      return sendJson(
        res,
        200,
        TOPICS.map(({ id, label, blurb, accent, feeds }) => ({
          id,
          label,
          blurb,
          accent,
          feedCount: feeds.length
        }))
      );
    }

    if (pathname === '/api/digest') {
      // Never block on a build. A slow host can take minutes to parse every
      // feed, and a waiting request just times out with nothing to show.
      if (url.searchParams.get('refresh') === '1') buildDigest({ force: true }).catch(() => {});
      const snap = digestSnapshot();
      if (snap.payload) {
        return sendJson(res, 200, snap.payload, { 'X-Digest-Building': String(snap.building) });
      }
      return sendJson(res, 202, {
        building: true,
        buildingForMs: snap.buildingForMs,
        message: "Gathering today's stories. This takes a minute on first start."
      });
    }

    if (pathname === '/api/archive') {
      return sendJson(res, 200, { days: await listArchive(), today: dayKey() });
    }

    if (pathname.startsWith('/api/archive/')) {
      const key = pathname.split('/').pop();
      const snap = await readSnapshot(key);
      if (!snap) return sendJson(res, 404, { error: 'No digest stored for that day.' });
      return sendJson(res, 200, snap);
    }

    if (pathname === '/api/brief') {
      const day = url.searchParams.get('day');
      const source = day ? await readSnapshot(day) : await buildDigest();
      if (!source) return sendJson(res, 404, { error: 'No digest stored for that day.' });
      return sendJson(res, 200, buildBrief(source));
    }

    // The service worker calls this when a push wakes it, so the notification
    // text is composed from the live briefing rather than baked into the push.
    if (pathname === '/api/brief/notification') {
      const brief = buildBrief(await buildDigest());
      return sendJson(res, 200, briefHeadline(brief));
    }

    // A self-contained HTML file: no stylesheet, no script, no remote images,
    // so the saved copy still opens correctly offline years from now.
    if (pathname === '/api/brief/download') {
      const day = url.searchParams.get('day');
      const source = day ? await readSnapshot(day) : await buildDigest();
      if (!source) return sendJson(res, 404, { error: 'No digest stored for that day.' });
      const brief = buildBrief(source);
      const html = briefToHTML(brief);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${briefFilename(brief)}"`,
        'Content-Length': Buffer.byteLength(html),
        'Cache-Control': 'no-store'
      });
      return res.end(html);
    }

    if (pathname === '/api/push/key') {
      return sendJson(res, 200, {
        publicKey: push.publicKey,
        subscribers: push.count,
        schedule: morningBriefing.status()
      });
    }

    if (pathname === '/api/push/subscribe' && req.method === 'POST') {
      const body = await readJson(req);
      const record = await push.subscribe(body.subscription || body);
      console.log(`[push] subscribed ${new URL(record.endpoint).host} (${push.count} total)`);
      return sendJson(res, 201, { ok: true, subscribers: push.count });
    }

    if (pathname === '/api/push/unsubscribe' && req.method === 'POST') {
      const body = await readJson(req);
      const removed = await push.unsubscribe(body.endpoint);
      return sendJson(res, 200, { ok: true, removed, subscribers: push.count });
    }

    /*
     * Called by an external cron service at 07:00 Asia/Jerusalem on hosts that
     * sleep when idle. The request itself wakes the app; this then rebuilds the
     * digest and pushes. Guarded so it cannot fire more than once an hour even
     * if the cron retries or fires twice.
     */
    if (pathname === '/api/brief/send' && (req.method === 'POST' || req.method === 'GET')) {
      const given = url.searchParams.get('key') || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!BRIEF_SEND_KEY) {
        return sendJson(res, 503, {
          error: 'This endpoint is disabled. Set BRIEF_SEND_KEY on the server to enable it.'
        });
      }
      if (!secretMatches(given)) {
        console.warn('[brief] rejected a send request with a bad key');
        return sendJson(res, 403, { error: 'Bad key.' });
      }

      const sinceLast = morningBriefing.lastRunAt
        ? Date.now() - Date.parse(morningBriefing.lastRunAt)
        : Infinity;
      if (sinceLast < 60 * 60 * 1000) {
        return sendJson(res, 200, {
          skipped: true,
          reason: 'A briefing already went out within the last hour.',
          lastRunAt: morningBriefing.lastRunAt
        });
      }

      const result = await morningBriefing.runNow();
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (pathname === '/api/push/test' && req.method === 'POST') {
      const result = await push.sendAll({ urgency: 'high' });
      return sendJson(res, 200, result);
    }

    if (pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        node: process.version,
        windowHours: CONFIG.maxAgeHours,
        topics: TOPICS.length,
        feeds: TOPICS.reduce((n, t) => n + t.feeds.length, 0),
        uptimeSeconds: Math.round(process.uptime()),
        push: { subscribers: push.count, schedule: morningBriefing.status() }
      });
    }

    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'Unknown endpoint' });
    }

    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[digest] request failed:', err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Internal error', detail: String(err?.message || err) });
  }
});

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) out.push(net.address);
    }
  }
  return out;
}

await push.init();
morningBriefing.start();

server.listen(PORT, HOST, () => {
  const feeds = TOPICS.reduce((n, t) => n + t.feeds.length, 0);
  console.log('');
  console.log('  Daily Digest');
  console.log(`  ${TOPICS.length} topics · ${feeds} sources · ${CONFIG.maxAgeHours}h freshness window`);
  console.log('');
  console.log(`  Local:    http://localhost:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`  Network:  http://${ip}:${PORT}   <- open this on your iPhone/iPad`);
  }
  console.log(`  Briefing: ${morningBriefing.status().next}  (${push.count} device(s) subscribed)`);
  console.log('');
  // Warm the cache so the first load is instant.
  buildDigest().then(
    (d) => console.log(`  Ready — ${d.totalArticles} fresh stories, ${d.health.feedsOk}/${d.health.feedsTotal} sources responding.\n`),
    (e) => console.warn('  Initial fetch failed:', e?.message || e)
  );
});
