// Builds the day's digest: fetch every feed, drop anything stale, dedupe, rank.

import fs from 'node:fs/promises';
import path from 'node:path';
import { TOPICS } from './feeds.js';
import { fetchFeed, dedupeKey } from './rss.js';
import { composeSummary } from './summarize.js';

export const CONFIG = {
  // Hard freshness ceiling. Anything published before this is never shown.
  maxAgeHours: Number(process.env.DIGEST_MAX_AGE_HOURS || 30),
  perTopic: Number(process.env.DIGEST_PER_TOPIC || 24),
  cacheTtlMs: Number(process.env.DIGEST_CACHE_MS || 10 * 60 * 1000),
  concurrency: 12,
  dataDir: process.env.DIGEST_DATA_DIR || path.join(process.cwd(), 'data')
};

let cache = { builtAt: 0, payload: null, building: null, startedAt: 0 };

/**
 * What is available right now, without blocking.
 *
 * Building the digest means parsing ~210 XML documents. On a small host that
 * takes minutes, and a request that waits for it simply times out — the page
 * sat on its loading skeleton forever. So requests are served whatever is
 * already built, a rebuild is kicked off in the background, and the client is
 * told to check back.
 */
export function digestSnapshot() {
  const fresh = cache.payload && Date.now() - cache.builtAt < CONFIG.cacheTtlMs;
  if (!fresh && !cache.building) {
    // Fire and forget; the error is reported through the next request.
    buildDigest({ force: true }).catch((err) =>
      console.warn('[digest] background build failed:', err?.message || err)
    );
  }
  return {
    payload: cache.payload,
    building: Boolean(cache.building),
    buildingForMs: cache.building ? Date.now() - cache.startedAt : 0,
    stale: Boolean(cache.payload) && !fresh
  };
}
// The last build that actually returned stories. A network blip must never be
// allowed to replace good data with an empty digest.
let lastGood = null;

async function pool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await worker(items[i], i);
      } catch (err) {
        results[i] = { error: err?.message || String(err) };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Feeds that cover everything, not one region or beat. When a regional topic
 * pulls from one of these, the story has to actually be about that region --
 * otherwise Al Jazeera's general wire drifts into the Middle East desk.
 */
const GENERAL_FEEDS = new Set([
  'https://www.aljazeera.com/xml/rss/all.xml',
  'https://www.france24.com/en/rss',
  'https://rss.dw.com/rdf/rss-en-all',
  'https://www.euronews.com/rss',
  'https://www.aa.com.tr/en/rss/default?cat=world',
  'https://www.economist.com/latest/rss.xml',
  'https://www.middleeastmonitor.com/feed/',
  'https://www.al-monitor.com/rss'
]);

/** Outlets whose homepage feeds repeat evergreen/explainer content. */
const NOISE = /^(watch|listen|live|in pictures|video|podcast|newsletter|quiz|crossword|weather forecast)\b[:\s-]/i;

function scoreArticle(a, now) {
  const ageHours = (now - Date.parse(a.published)) / 3.6e6;
  let score = Math.max(0, 100 - ageHours * 2.2); // recency dominates
  score += Math.min(a.corroboration * 9, 36); // reported by several outlets
  if (a.image) score += 6;
  if (a.summary && a.summary.length > 90) score += 4;
  if (a.title.length > 34 && a.title.length < 120) score += 3;
  return score;
}

/** Words that carry no signal when comparing two headlines. */
const STOP = new Set(
  ('the a an of in on to for and as at is are was were with says say said by from '
   + 'after before over into that this it its his her their they he she we you i '
   + 'but or not no new more than been being have has had will would could should '
   + 'about up down out off can may might who what when where why how amid via').split(' ')
);

/**
 * Crude suffix trimming so "attack"/"attacks" and "kill"/"killed" compare
 * equal. Not a real stemmer -- just enough that a plural in one newsroom's
 * headline doesn't stop it matching another's.
 */
function stem(word) {
  if (word.length >= 6 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length >= 5 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length >= 5 && word.endsWith('s') && !/(ss|us|is)$/.test(word)) {
    return word.slice(0, -1);
  }
  return word;
}

function titleTokens(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map(stem)
  );
}

/**
 * How much two headlines are about the same thing, 0-1.
 *
 * Jaccard alone under-scores a pair where one newsroom wrote a longer headline
 * ("Polanski seeks to stand for by-election in former PM Starmer's seat" vs
 * "Polanski to stand in Keir Starmer seat as Green party candidate" scores
 * 0.42). The overlap coefficient - shared over the shorter headline - handles
 * that, so take whichever is more confident, with the overlap route needing an
 * extra shared word to guard against a short headline sitting inside an
 * unrelated longer one.
 */
function similarity(a, b) {
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  if (shared < 3) return 0; // too little overlap to trust on short headlines

  const union = a.size + b.size - shared;
  const jaccard = shared / union;
  const overlap = shared / Math.min(a.size, b.size);

  if (shared >= 4 && overlap >= 0.62) return Math.max(jaccard, overlap);
  return jaccard;
}

// Known limit: comparing word sets cannot separate two headlines that differ
// only in their subject ("Fed holds rates steady as inflation cools" vs "Bank
// of England holds rates steady as inflation cools" scores 0.63). Those merge.
// It is rare, and the alternative -- a threshold high enough to split them --
// would stop genuine rewrites of the same story from merging at all.


/**
 * Second dedupe pass. The exact-key bucket only catches headlines that open the
 * same way; two newsrooms rewriting the same story ("Polanski seeks to stand in
 * Starmer's seat" / "Polanski to stand in Keir Starmer seat") slip past it.
 * This compares word sets instead, so the same event collapses into one entry
 * that credits every outlet covering it.
 *
 * Input must be pre-sorted best-first: the first article of a group becomes the
 * one shown.
 */
function mergeSimilar(items, threshold = 0.45) {
  const groups = [];
  const byToken = new Map();

  for (const article of items) {
    const tokens = titleTokens(article.title);

    let target = -1;
    let best = 0;
    const considered = new Set();
    for (const token of tokens) {
      for (const gi of byToken.get(token) || []) {
        if (considered.has(gi)) continue;
        considered.add(gi);
        const sim = similarity(tokens, groups[gi].tokens);
        if (sim > best) {
          best = sim;
          target = gi;
        }
      }
    }

    // A cap stops one loose match from snowballing and swallowing a whole
    // section of unrelated stories.
    if (target >= 0 && best >= threshold && groups[target].members < 8) {
      const g = groups[target];
      g.members++;
      const lead = g.lead;
      lead.corroboration++;
      if (article.source !== lead.source && !lead.alsoIn.includes(article.source)) {
        lead.alsoIn.push(article.source);
      }
      if (!lead.image && article.image) lead.image = article.image;
      // Pool this outlet's wording too, rather than keeping only the longest.
      lead.summaries = lead.summaries || (lead.summary ? [lead.summary] : []);
      for (const extra of article.summaries || (article.summary ? [article.summary] : [])) {
        if (extra && !lead.summaries.includes(extra)) lead.summaries.push(extra);
      }
      if (Date.parse(article.published) > Date.parse(lead.published)) {
        lead.published = article.published;
      }
      continue;
    }

    groups.push({ lead: article, tokens, members: 1 });
    const gi = groups.length - 1;
    for (const token of tokens) {
      const list = byToken.get(token);
      if (list) list.push(gi);
      else byToken.set(token, [gi]);
    }
  }

  return groups.map((g) => g.lead);
}

/**
 * Greedy pick that spreads a topic across outlets. A prolific wire can
 * out-publish everyone on pure recency; each story already taken from an
 * outlet makes its next one cost more, so the lead spots show a real range of
 * publications rather than one newsroom's afternoon.
 */
function diversify(scored, limit) {
  const PENALTY = 14;
  const pool = [...scored];
  const taken = new Map();
  const out = [];

  while (out.length < limit && pool.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      const value = pool[i].score - (taken.get(pool[i].source) || 0) * PENALTY;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = i;
      }
    }
    const [pick] = pool.splice(bestIndex, 1);
    taken.set(pick.source, (taken.get(pick.source) || 0) + 1);
    out.push(pick);
  }
  return out;
}

/**
 * One fetch-and-parse per unique URL per build.
 *
 * Topics deliberately overlap — Al Jazeera's feed backs six desks — so without
 * this the same XML was downloaded and regex-parsed six times. Wasteful
 * anywhere; on a 0.1-CPU host it is the difference between a digest arriving
 * and a request timing out.
 */
function makeFeedCache() {
  const inflight = new Map();
  return (url) => {
    if (!inflight.has(url)) inflight.set(url, fetchFeed(url));
    return inflight.get(url);
  };
}

async function buildTopic(topic, cutoffMs, now, getFeed) {
  const batches = await pool(topic.feeds, CONFIG.concurrency, (url) => getFeed(url));

  const bucket = new Map();
  let ok = 0;
  const failures = [];

  batches.forEach((res, i) => {
    if (!Array.isArray(res)) {
      failures.push({ feed: topic.feeds[i], error: res?.error || 'unknown' });
      return;
    }
    ok++;
    const needsRelevance = Boolean(topic.relevance) && GENERAL_FEEDS.has(topic.feeds[i]);
    for (const article of res) {
      const ts = Date.parse(article.published);
      if (!Number.isFinite(ts) || ts < cutoffMs) continue; // stale — drop it
      if (ts > now + 6 * 3.6e6) continue; // clock-skewed future dates
      if (NOISE.test(article.title)) continue;
      if (needsRelevance && !topic.relevance.test(`${article.title} ${article.summary}`)) continue;

      const key = dedupeKey(article);
      if (!key) continue;
      const existing = bucket.get(key);
      if (!existing) {
        // summaries[] pools what every outlet said about this story. It is
        // composed into prose below and dropped before the payload is sent.
        bucket.set(key, {
          ...article,
          corroboration: 0,
          alsoIn: [],
          summaries: article.summary ? [article.summary] : []
        });
      } else {
        existing.corroboration++;
        if (!existing.alsoIn.includes(article.source) && article.source !== existing.source) {
          existing.alsoIn.push(article.source);
        }
        // Keep the richest version of the story.
        if (!existing.image && article.image) {
          existing.image = article.image;
          existing.imageFallback = article.imageFallback || '';
        }
        if (article.summary && !existing.summaries.includes(article.summary)) {
          existing.summaries.push(article.summary);
        }
        if (ts > Date.parse(existing.published)) existing.published = article.published;
      }
    }
  });

  // Best version of each story first, so it survives the fuzzy merge as the
  // one displayed; then re-score, since merging changes corroboration counts.
  const ranked = [...bucket.values()].sort(
    (x, y) => scoreArticle(y, now) - scoreArticle(x, now)
  );
  const articles = diversify(
    mergeSimilar(ranked).map((a) => ({ ...a, score: scoreArticle(a, now) })),
    CONFIG.perTopic
  ).map(({ score, summaries, ...rest }) => {
    /*
     * Compose here so the pooled descriptions never travel to the client.
     * `summary` is the couple of sentences a feed card shows; `summaryFull` is
     * the fuller version the one-page briefing prints. Both end on a complete
     * sentence — nothing is cut mid-thought.
     */
    const pool = {
      title: rest.title,
      summaries: summaries && summaries.length ? summaries : rest.summary ? [rest.summary] : []
    };
    return {
      ...rest,
      summary: composeSummary(pool, 300, 2) || rest.summary || '',
      summaryFull: composeSummary(pool, 520, 4) || rest.summary || ''
    };
  });

  return {
    id: topic.id,
    label: topic.label,
    blurb: topic.blurb,
    accent: topic.accent,
    articles,
    feedsOk: ok,
    feedsTotal: topic.feeds.length,
    failures
  };
}

export async function buildDigest({ force = false } = {}) {
  if (!force && cache.payload && Date.now() - cache.builtAt < CONFIG.cacheTtlMs) {
    return cache.payload;
  }
  if (cache.building) return cache.building;

  cache.startedAt = Date.now();
  cache.building = (async () => {
    const now = Date.now();
    const cutoffMs = now - CONFIG.maxAgeHours * 3.6e6;

    const getFeed = makeFeedCache();
    const sections = await pool(TOPICS, 4, (topic) => buildTopic(topic, cutoffMs, now, getFeed));

    const good = sections.filter((s) => s && s.id);
    const totalArticles = good.reduce((n, s) => n + s.articles.length, 0);

    const feedsOk = good.reduce((n, s) => n + s.feedsOk, 0);
    const feedsTotal = good.reduce((n, s) => n + s.feedsTotal, 0);

    const payload = {
      generatedAt: new Date(now).toISOString(),
      windowHours: CONFIG.maxAgeHours,
      oldestAllowed: new Date(cutoffMs).toISOString(),
      totalArticles,
      topics: good,
      health: { feedsOk, feedsTotal }
    };

    // A build that reached nothing means the machine was offline, not that the
    // world stopped publishing. Keep serving the last good digest, flagged as
    // stale, and leave the stored snapshot alone.
    if (totalArticles === 0 && lastGood) {
      console.warn(`[digest] build reached ${feedsOk}/${feedsTotal} feeds and found nothing — keeping the previous digest.`);
      cache = { builtAt: 0, payload: null, building: null };
      return { ...lastGood, degraded: true, degradedAt: new Date(now).toISOString() };
    }

    cache = { builtAt: now, payload, building: null, startedAt: 0 };
    console.log(
      `[digest] built ${payload.totalArticles} stories from ` +
        `${payload.health.feedsOk}/${payload.health.feedsTotal} feeds in ` +
        `${((Date.now() - now) / 1000).toFixed(1)}s`
    );
    if (totalArticles > 0) {
      lastGood = payload;
      saveSnapshot(payload).catch(() => {});
    }
    return payload;
  })();

  try {
    return await cache.building;
  } finally {
    cache.building = null;
  }
}

export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Persist today's digest so the app builds a real day-by-day archive as it runs.
 * Each snapshot is rewritten through the day, so it always holds that day's
 * final state.
 */
async function saveSnapshot(payload) {
  if (!payload.totalArticles) return;
  await fs.mkdir(CONFIG.dataDir, { recursive: true });
  const key = dayKey(new Date(payload.generatedAt));
  const file = path.join(CONFIG.dataDir, `${key}.json`);

  // Merge rather than replace: a later build with a few failing feeds should
  // not drop stories that were already captured earlier in the day.
  const existing = await readSnapshot(key);
  const merged = existing ? mergeSnapshots(existing, payload) : payload;

  await fs.writeFile(file, JSON.stringify(merged), 'utf8');
  await pruneSnapshots();
}

/** Union of two digests for the same day, newest metadata winning. */
function mergeSnapshots(older, newer) {
  const byId = new Map(older.topics.map((t) => [t.id, t]));
  const topics = newer.topics.map((t) => {
    const prev = byId.get(t.id);
    if (!prev) return t;
    const seen = new Set(t.articles.map((a) => a.link));
    const carried = prev.articles.filter((a) => !seen.has(a.link));
    const articles = [...t.articles, ...carried]
      .sort((x, y) => Date.parse(y.published) - Date.parse(x.published))
      .slice(0, CONFIG.perTopic);
    return { ...t, articles };
  });
  return {
    ...newer,
    topics,
    totalArticles: topics.reduce((n, t) => n + t.articles.length, 0)
  };
}

async function pruneSnapshots(keep = 30) {
  try {
    const files = (await fs.readdir(CONFIG.dataDir))
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();
    await Promise.all(
      files.slice(keep).map((f) => fs.unlink(path.join(CONFIG.dataDir, f)).catch(() => {}))
    );
  } catch {}
}

export async function listArchive() {
  try {
    const files = await fs.readdir(CONFIG.dataDir);
    return files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.replace('.json', ''))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function readSnapshot(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  try {
    const raw = await fs.readFile(path.join(CONFIG.dataDir, `${key}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
