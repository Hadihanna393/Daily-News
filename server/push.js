// Web Push (VAPID) with no dependencies.
//
// Notifications are sent as "tickles" — a push with no payload. The service
// worker wakes up, fetches the current briefing itself, and shows it. That
// skips the AES128GCM payload encryption the spec otherwise requires, and has
// the nicer property that the notification always reflects the live briefing
// rather than whatever was true when the push was queued.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/*
 * The VAPID "sub" claim identifies the sender to the push service. Apple
 * validates it strictly and rejects the whole JWT with 403 BadJwtToken if it is
 * not a syntactically valid mailto: address or https: URL — "localhost" has no
 * TLD, so the obvious-looking mailto:daily-digest@localhost silently broke every
 * push to an iPhone while Google's FCM accepted the same token. It must be a
 * real-looking address; it is never contacted.
 */
const DEFAULT_SUBJECT = 'mailto:daily-digest@example.com';

function isValidSubject(value) {
  if (typeof value !== 'string') return false;
  if (/^https:\/\/[^\s/]+\.[a-z]{2,}(\/|$)/i.test(value)) return true;
  return /^mailto:[^\s@]+@[^\s@.]+\.[a-z]{2,}$/i.test(value);
}

const CONFIGURED_SUBJECT = process.env.VAPID_SUBJECT;
const SUBJECT = isValidSubject(CONFIGURED_SUBJECT) ? CONFIGURED_SUBJECT : DEFAULT_SUBJECT;

if (CONFIGURED_SUBJECT && !isValidSubject(CONFIGURED_SUBJECT)) {
  console.warn(
    `[push] VAPID_SUBJECT ${JSON.stringify(CONFIGURED_SUBJECT)} is not a valid ` +
      `mailto: address or https: URL; Apple would reject it. Using ${DEFAULT_SUBJECT}.`
  );
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export class PushService {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.keysFile = path.join(dataDir, 'vapid.json');
    this.subsFile = path.join(dataDir, 'subscriptions.json');
    this.keys = null;
    this.subs = [];
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    this.keys = await this.loadKeys();
    this.subs = await this.loadSubs();
    return this;
  }

  /**
   * The VAPID keypair is generated once and reused. It MUST stay stable: a
   * browser's push subscription is cryptographically bound to the public key it
   * subscribed with, so new keys silently invalidate every existing device.
   *
   * Hosts commonly reset the filesystem on redeploy, so environment variables
   * take precedence over the on-disk copy. Run `npm run vapid:export` to print
   * the two values to paste into the host's config.
   */
  async loadKeys() {
    const envPublic = process.env.VAPID_PUBLIC_KEY;
    const envPrivate = process.env.VAPID_PRIVATE_KEY;
    if (envPublic && envPrivate) {
      // Accepts either a PEM pasted directly (where a host may have turned the
      // line breaks into literal backslash-n) or, more reliably, base64 of it.
      const privatePem = envPrivate.includes('BEGIN')
        ? envPrivate.replace(/\\n/g, '\n')
        : Buffer.from(envPrivate, 'base64').toString('utf8');
      try {
        crypto.createPrivateKey(privatePem); // fail loudly now, not at 07:00
      } catch (err) {
        throw new Error(`VAPID_PRIVATE_KEY could not be parsed: ${err.message}`);
      }
      console.log('[push] using VAPID keys from the environment');
      return { publicKey: envPublic.trim(), privatePem, source: 'env' };
    }

    try {
      return JSON.parse(await fs.readFile(this.keysFile, 'utf8'));
    } catch {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1'
      });
      const jwk = publicKey.export({ format: 'jwk' });
      const raw = Buffer.concat([Buffer.from([4]), fromB64url(jwk.x), fromB64url(jwk.y)]);
      const keys = {
        publicKey: b64url(raw),
        privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
        createdAt: new Date().toISOString()
      };
      await fs.writeFile(this.keysFile, JSON.stringify(keys, null, 2), 'utf8');
      return keys;
    }
  }

  async loadSubs() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.subsFile, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async saveSubs() {
    await fs.writeFile(this.subsFile, JSON.stringify(this.subs, null, 2), 'utf8');
  }

  get publicKey() {
    return this.keys.publicKey;
  }

  get count() {
    return this.subs.length;
  }

  async subscribe(subscription) {
    if (!subscription?.endpoint || !/^https:\/\//.test(subscription.endpoint)) {
      throw new Error('A push subscription needs an https endpoint.');
    }
    const existing = this.subs.findIndex((s) => s.endpoint === subscription.endpoint);
    const record = { endpoint: subscription.endpoint, addedAt: new Date().toISOString() };
    if (existing >= 0) this.subs[existing] = record;
    else this.subs.push(record);
    await this.saveSubs();
    return record;
  }

  async unsubscribe(endpoint) {
    const before = this.subs.length;
    this.subs = this.subs.filter((s) => s.endpoint !== endpoint);
    if (this.subs.length !== before) await this.saveSubs();
    return before - this.subs.length;
  }

  /** Signed JWT proving to the push service who is sending. */
  signToken(audience) {
    const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
    const body = b64url(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: SUBJECT
      })
    );
    const signingInput = `${header}.${body}`;
    const signature = crypto.sign('sha256', Buffer.from(signingInput), {
      key: crypto.createPrivateKey(this.keys.privatePem),
      dsaEncoding: 'ieee-p1363' // raw r||s, which is what JWS ES256 expects
    });
    return `${signingInput}.${b64url(signature)}`;
  }

  async sendOne(endpoint, { ttl = 3 * 60 * 60, urgency = 'normal' } = {}) {
    const audience = new URL(endpoint).origin;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${this.signToken(audience)}, k=${this.publicKey}`,
        TTL: String(ttl),
        Urgency: urgency,
        'Content-Length': '0'
      }
    });
    return res;
  }

  /**
   * Push to every subscriber. Endpoints the push service reports as gone are
   * dropped, so the list does not grow stale forever.
   */
  async sendAll(options) {
    if (!this.subs.length) return { sent: 0, failed: 0, removed: 0 };

    let sent = 0;
    let failed = 0;
    const dead = [];

    await Promise.all(
      this.subs.map(async (sub) => {
        try {
          const res = await this.sendOne(sub.endpoint, options);
          if (res.status === 404 || res.status === 410) {
            dead.push(sub.endpoint);
          } else if (res.ok || res.status === 201) {
            sent++;
          } else {
            failed++;
            // Push services explain themselves in the body; Apple returns
            // {"reason":"BadJwtToken"}. Without this the log said only "403".
            const detail = await res.text().catch(() => '');
            console.warn(
              `[push] ${res.status} from ${new URL(sub.endpoint).host}` +
                (detail ? ` — ${detail.slice(0, 200).replace(/\s+/g, ' ')}` : '')
            );
          }
        } catch (err) {
          failed++;
          console.warn('[push] send failed:', err?.message || err);
        }
      })
    );

    if (dead.length) {
      this.subs = this.subs.filter((s) => !dead.includes(s.endpoint));
      await this.saveSubs();
    }

    return { sent, failed, removed: dead.length };
  }
}
