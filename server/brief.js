// Composes the day's one-page briefing from a built digest.
//
// This is deliberately deterministic: it selects and arranges real headlines
// rather than generating prose, so it never invents a fact and needs no API key.

/** Desks that always get their own line in the rundown, in this order. */
const RUNDOWN = [
  'israel',
  'mideast',
  'world',
  'politics',
  'us',
  'uk',
  'business',
  'markets',
  'tech',
  'science',
  'health',
  'climate',
  'sports',
  'entertainment'
];

/** The desk this reader cares most about gets an expanded block. */
const FOCUS_TOPIC = 'israel';

function outletCount(a) {
  return 1 + (a.alsoIn?.length || 0);
}

/**
 * Importance for the briefing, which is not the same as importance for the
 * feed. Here, how many independent newsrooms ran the story matters most —
 * that is the clearest available signal that something actually happened,
 * as opposed to one outlet having a quiet afternoon.
 */
function briefScore(a, now) {
  const ageHours = (now - Date.parse(a.published)) / 3.6e6;
  return outletCount(a) * 30 + Math.max(0, 40 - ageHours * 1.4) + (a.summary ? 5 : 0);
}

const STOP = new Set([
  'the','a','an','of','in','on','to','for','and','as','at','is','are','was','were','with','says',
  'say','said','after','over','from','by','its','his','her','their','this','that','new','has',
  'have','had','been','will','be','it','not','but','who','how','why','what','into','amid','about'
]);

/** Significant words in a headline, used to spot the same story twice. */
function titleTokens(title) {
  return new Set(
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

/**
 * Containment rather than Jaccard: a short headline that is wholly contained in
 * a longer one is the same story, even though the union would look small.
 * Cross-outlet dedupe already merges identical wordings; this catches the case
 * where two newsrooms describe one event differently — "Feminist activist and
 * journalist Gloria Steinem dies" versus "Gloria Steinem, groundbreaking
 * feminist campaigner, dies aged 92".
 */
function sameStory(a, b, threshold = 0.5) {
  const A = a._tokens;
  const B = b._tokens;
  if (!A?.size || !B?.size) return false;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared++;
  return shared / Math.min(A.size, B.size) >= threshold;
}

function trimSummary(text = '', max = 240) {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (stop > max * 0.55) return cut.slice(0, stop + 1);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

function slim(a, topic) {
  return {
    _tokens: titleTokens(a.title),
    title: a.title,
    link: a.link,
    summary: trimSummary(a.summary),
    source: a.source,
    alsoIn: a.alsoIn || [],
    outlets: outletCount(a),
    published: a.published,
    image: a.image || '',
    topicId: topic?.id || a.topicId || '',
    topicLabel: topic?.label || a.topicLabel || '',
    accent: topic?.accent || a.accent || ''
  };
}

export function buildBrief(digest) {
  const now = Date.parse(digest.generatedAt) || Date.now();

  // Flatten, keeping each story's desk, and drop repeats across desks.
  const seen = new Set();
  const all = [];
  for (const topic of digest.topics) {
    for (const a of topic.articles) {
      if (seen.has(a.link)) continue;
      seen.add(a.link);
      all.push({ article: a, topic });
    }
  }

  const ranked = all
    .map(({ article, topic }) => ({ ...slim(article, topic), _score: briefScore(article, now) }))
    .sort((x, y) => y._score - x._score);

  const used = new Set();
  const picked = [];
  const isRepeat = (a) => used.has(a.link) || picked.some((p) => sameStory(a, p));
  const claim = (a) => {
    used.add(a.link);
    picked.push(a);
    return a;
  };
  const take = (list, n) => {
    const out = [];
    for (const a of list) {
      if (out.length >= n) break;
      if (isRepeat(a)) continue;
      out.push(claim(a));
    }
    return out;
  };

  // One lead, then four more from different desks, so the top of the page is a
  // picture of the day rather than four angles on one situation.
  const [lead] = take(ranked, 1);
  const deskSeen = new Set(lead ? [lead.topicId] : []);
  const alsoLeading = [];
  for (const a of ranked) {
    if (alsoLeading.length >= 4) break;
    if (deskSeen.has(a.topicId) || isRepeat(a)) continue;
    deskSeen.add(a.topicId);
    alsoLeading.push(claim(a));
  }
  // If the day is quiet enough that four desks cannot be filled, top up.
  if (alsoLeading.length < 4) alsoLeading.push(...take(ranked, 4 - alsoLeading.length));

  // The focus desk gets its own block.
  const focus = digest.topics.find((t) => t.id === FOCUS_TOPIC);
  const focusStories = focus
    ? take(
        focus.articles
          .map((a) => ({ ...slim(a, focus), _score: briefScore(a, now) }))
          .sort((x, y) => y._score - x._score),
        4
      )
    : [];

  // One line per desk.
  const rundown = [];
  for (const id of RUNDOWN) {
    // The focus desk already has its own block above.
    if (id === FOCUS_TOPIC && focusStories.length) continue;
    const topic = digest.topics.find((t) => t.id === id);
    if (!topic || !topic.articles.length) continue;
    const best = topic.articles
      .map((a) => ({ ...slim(a, topic), _score: briefScore(a, now) }))
      .sort((x, y) => y._score - x._score)
      .find((a) => !isRepeat(a)) || slim(topic.articles[0], topic);
    claim(best);
    rundown.push({
      id: topic.id,
      label: topic.label,
      accent: topic.accent,
      count: topic.articles.length,
      story: best
    });
  }

  const publications = new Set(all.map(({ article }) => article.source));
  const busiest = [...digest.topics].sort((a, b) => b.articles.length - a.articles.length)[0];
  const newest = all.reduce(
    (t, { article }) => Math.max(t, Date.parse(article.published) || 0),
    0
  );
  const corroborated = all.filter(({ article }) => outletCount(article) > 1).length;

  const strip = ({ _score, _tokens, ...rest }) => rest;

  return {
    generatedAt: digest.generatedAt,
    windowHours: digest.windowHours,
    lead: lead ? strip(lead) : null,
    alsoLeading: alsoLeading.map(strip),
    focus: focus
      ? { id: focus.id, label: focus.label, accent: focus.accent, stories: focusStories.map(strip) }
      : null,
    rundown: rundown.map((r) => ({ ...r, story: strip(r.story) })),
    numbers: {
      stories: digest.totalArticles,
      publications: publications.size,
      topics: digest.topics.filter((t) => t.articles.length).length,
      corroborated,
      busiestDesk: busiest ? busiest.label : '',
      busiestCount: busiest ? busiest.articles.length : 0,
      newestAt: newest ? new Date(newest).toISOString() : digest.generatedAt
    }
  };
}

/** Short text used for the morning push notification. */
export function briefHeadline(brief) {
  const title = brief.lead?.title || 'Your morning briefing is ready';
  const extras = brief.alsoLeading.slice(0, 2).map((a) => a.title);
  const body = extras.length ? `${extras.join(' · ')}` : `${brief.numbers.stories} stories waiting.`;
  return {
    title: title.length > 90 ? title.slice(0, 89) + '…' : title,
    body: body.length > 160 ? body.slice(0, 159) + '…' : body
  };
}
