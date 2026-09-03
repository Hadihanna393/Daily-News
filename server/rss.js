// Minimal, dependency-free RSS 2.0 / Atom / RDF parser plus fetching helpers.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36 DailyDigest/1.0 (+personal news reader)';

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–',
  mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç',
  uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß', pound: '£',
  euro: '€', deg: '°', copy: '©', reg: '®', trade: '™',
  middot: '·', bull: '•', laquo: '«', raquo: '»', times: '×'
};

export function decodeEntities(str = '') {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => NAMED_ENTITIES[name] ?? m);
}

function safeChar(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/**
 * Strip tags, collapse whitespace, decode entities.
 *
 * Entities are decoded BEFORE tags are stripped. Several feeds (the Jerusalem
 * Post among them) escape their markup, so a description arrives as
 * "&lt;img src=...&gt;" -- decoding last would turn that back into visible
 * markup after the stripping pass had already run. A second decode afterwards
 * catches anything that was double-encoded.
 */
export function toPlainText(html = '') {
  let text = String(html).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  text = decodeEntities(text);
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h\d)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/<[^>]*$/, ' '); // a tag cut off by an upstream truncation
  return decodeEntities(text).replace(/\s+/g, ' ').trim();
}

function unwrapCdata(str = '') {
  const m = String(str).match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : str;
}

/** First matching child tag's inner text, namespace-tolerant. */
function tagText(xml, ...names) {
  for (const name of names) {
    const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i');
    const m = xml.match(re);
    if (m && m[1] != null) {
      const v = unwrapCdata(m[1]).trim();
      if (v) return v;
    }
  }
  return '';
}

function attrOf(xml, tagPattern, attr) {
  const re = new RegExp(`<${tagPattern}\\b[^>]*\\b${attr}\\s*=\\s*["']([^"']+)["'][^>]*>`, 'i');
  const m = xml.match(re);
  return m ? decodeEntities(m[1]) : '';
}

/** Atom links: prefer rel="alternate" (or no rel) with an http href. */
function atomLink(xml) {
  const links = xml.match(/<link\b[^>]*\/?>/gi) || [];
  let fallback = '';
  for (const tag of links) {
    const href = (tag.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!href || !/^https?:/i.test(href)) continue;
    const rel = (tag.match(/rel\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!rel || /alternate/i.test(rel)) return decodeEntities(href);
    if (!fallback) fallback = decodeEntities(href);
  }
  return fallback;
}

const IMG_EXT = /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i;

/**
 * Upgrades to a larger variant, but only for hosts where that is known to work.
 *
 * Most image CDNs sign their URLs: The Guardian's i.guim.co.uk carries an HMAC
 * in `s=`, and asking it for a bigger `width=` returns 401. So rewriting sizes
 * is opt-in per host and each rule below was checked against the live CDN.
 */
const CDN_UPGRADES = [
  {
    // BBC's ichef takes the width from the path and does not sign URLs.
    // Verified: /ace/standard/240/ -> /ace/standard/1024/ returns 1024x576.
    host: /(^|\.)bbci\.co\.uk$/i,
    upgrade: (u) => u.replace(/\/ace\/([a-z_]+)\/\d+\//i, '/ace/$1/1024/')
  },
  {
    // Haaretz advertises only a 108x81 thumbnail, but its CDN is unsigned and
    // will render any width. Verified: ?width=1200 returns 1200x801 at 59 KB.
    // (Dropping the query entirely gives the 2200px original, which is 193 KB —
    // more than a phone on cellular should pay for a card image.)
    host: /(^|\.)haarets\.co\.il$/i,
    upgrade: (u) => u.split('?')[0] + '?width=1200'
  },
  {
    // NPR ships the full-resolution original — one lead image measured 4919px
    // and 3.6 MB, which is indefensible on a phone. Brightspot takes the target
    // size from the path. The height must be scaled proportionally: forcing
    // 1200x800 on a 4:3 source stretched it to 3:2.
    host: /(^|\.)brightspotcdn\.com$/i,
    upgrade: (u) =>
      u.replace(/\/resize\/(\d+)x(\d+)(!?)\//, (whole, w, h, bang) => {
        const width = Number(w);
        const height = Number(h);
        if (!width || !height || width <= 1400) return whole;
        return `/resize/1200x${Math.round(1200 * (height / width))}${bang}/`;
      })
  },
  {
    // NYT's biggest named variants run to 1-1.3 MB. "jumbo" is 1024px wide and
    // about a fifth of the bytes, and is landscape rather than square, which
    // suits the cards better. If a given photo has no jumbo rendition the
    // client falls back to the original URL (see imageFallback below).
    host: /(^|\.)nyt\.com$/i,
    upgrade: (u) => u.replace(/-(superJumbo|mediumSquareAt3X)\.(jpe?g|png)/i, '-jumbo.$2')
  }
];

function upgradeImage(url) {
  try {
    const host = new URL(url).hostname;
    for (const rule of CDN_UPGRADES) {
      if (rule.host.test(host)) return rule.upgrade(url);
    }
  } catch {}
  return url;
}

function tagsOf(xml, name) {
  return xml.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) || [];
}

function attrIn(tag, attr) {
  const m = tag.match(new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

/**
 * Feeds often advertise the same picture at several sizes — The Guardian ships
 * 140px, 460px and 700px variants, in that order. Taking the first match meant
 * every Guardian lead story rendered a 140px thumbnail stretched across a
 * 640px card. Pick the widest one instead.
 */
function extractImage(itemXml) {
  const candidates = [];

  for (const name of ['media:content', 'media:thumbnail', 'itunes:image', 'enclosure']) {
    for (const tag of tagsOf(itemXml, name)) {
      const type = attrIn(tag, 'type');
      if (type && !/^image\//i.test(type)) continue; // audio/video enclosures
      const url = attrIn(tag, 'url') || attrIn(tag, 'href');
      if (!url || !/^https?:/i.test(url)) continue;
      const width = Number(attrIn(tag, 'width')) || 0;
      candidates.push({ url, width });
    }
  }

  if (candidates.length) {
    candidates.sort((a, b) => b.width - a.width);
    return candidates[0].url;
  }

  // Fall back to the first <img> inside the description/content HTML.
  const html = itemXml.match(/<img[^>]*src\s*=\s*["']([^"']+)["']/i);
  if (html && /^https?:/i.test(html[1])) return decodeEntities(html[1]);
  const raw = itemXml.match(/https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp)/i);
  if (raw && IMG_EXT.test(raw[0])) return decodeEntities(raw[0]);
  return '';
}

function parseDate(str) {
  if (!str) return null;
  const t = Date.parse(String(str).trim());
  return Number.isNaN(t) ? null : new Date(t);
}

function splitItems(xml) {
  const out = [];
  const re = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(xml))) out.push(m[2]);
  return out;
}

/**
 * Feed <title> elements are inconsistent ("NPR Topics: News", "World news |
 * The Guardian"). Map the outlet by domain instead so bylines read cleanly.
 * Keys are matched against the article's own host first, then the feed's.
 */
const OUTLETS = {
  'bbci.co.uk': 'BBC News',
  'bbc.co.uk': 'BBC News',
  'bbc.com': 'BBC News',
  'theguardian.com': 'The Guardian',
  'npr.org': 'NPR',
  'nytimes.com': 'The New York Times',
  'aljazeera.com': 'Al Jazeera',
  'axios.com': 'Axios',
  'cnbc.com': 'CNBC',
  'washingtonpost.com': 'The Washington Post',
  'politico.com': 'Politico',
  'thehill.com': 'The Hill',
  'marketwatch.com': 'MarketWatch',
  'dowjones.io': 'MarketWatch',
  'finance.yahoo.com': 'Yahoo Finance',
  'sports.yahoo.com': 'Yahoo Sports',
  'yahoo.com': 'Yahoo News',
  'cbssports.com': 'CBS Sports',
  'espn.com': 'ESPN',
  'arstechnica.com': 'Ars Technica',
  'theverge.com': 'The Verge',
  'techcrunch.com': 'TechCrunch',
  'wired.com': 'WIRED',
  'engadget.com': 'Engadget',
  'technologyreview.com': 'MIT Technology Review',
  'venturebeat.com': 'VentureBeat',
  'phys.org': 'Phys.org',
  'sciencedaily.com': 'ScienceDaily',
  'nature.com': 'Nature',
  'space.com': 'Space.com',
  'spacenews.com': 'SpaceNews',
  'statnews.com': 'STAT',
  'insideclimatenews.org': 'Inside Climate News',
  'grist.org': 'Grist',
  'carbonbrief.org': 'Carbon Brief',
  'oilprice.com': 'OilPrice',
  'variety.com': 'Variety',
  'hollywoodreporter.com': 'The Hollywood Reporter',
  'deadline.com': 'Deadline',
  'pitchfork.com': 'Pitchfork',
  'polygon.com': 'Polygon',
  'eurogamer.net': 'Eurogamer',
  'ign.com': 'IGN',
  'kotaku.com': 'Kotaku',
  'krebsonsecurity.com': 'Krebs on Security',
  'bleepingcomputer.com': 'BleepingComputer',
  'thehackernews.com': 'The Hacker News',
  'darkreading.com': 'Dark Reading',
  'coindesk.com': 'CoinDesk',
  'cointelegraph.com': 'Cointelegraph',
  'decrypt.co': 'Decrypt',
  'breakingdefense.com': 'Breaking Defense',
  'warontherocks.com': 'War on the Rocks',
  'defensenews.com': 'Defense News',
  'scotusblog.com': 'SCOTUSblog',
  'niemanlab.org': 'Nieman Lab',
  'poynter.org': 'Poynter',
  'skift.com': 'Skift',
  'eater.com': 'Eater',
  'bonappetit.com': 'Bon Appetit',
  'caranddriver.com': 'Car and Driver',
  'timesofisrael.com': 'The Times of Israel',
  'haaretz.com': 'Haaretz',
  'jpost.com': 'The Jerusalem Post',
  'israelhayom.com': 'Israel Hayom',
  'jns.org': 'JNS',
  'jewishpress.com': 'The Jewish Press',
  '972mag.com': '+972 Magazine',
  'globes.co.il': 'Globes',
  'electronicintifada.net': 'The Electronic Intifada',
  'imemc.org': 'IMEMC News',
  'mondoweiss.net': 'Mondoweiss',
  'middleeastmonitor.com': 'Middle East Monitor',
  'middleeasteye.net': 'Middle East Eye',
  'al-monitor.com': 'Al-Monitor',
  'newarab.com': 'The New Arab',
  'aa.com.tr': 'Anadolu Agency',
  'france24.com': 'France 24',
  'dw.com': 'DW',
  'euronews.com': 'Euronews',
  'skynews.com': 'Sky News',
  'sky.com': 'Sky News',
  'cbsnews.com': 'CBS News',
  'abcnews.go.com': 'ABC News',
  'nbcnews.com': 'NBC News',
  'pbs.org': 'PBS NewsHour',
  'foxnews.com': 'Fox News',
  'cbc.ca': 'CBC News',
  'channelnewsasia.com': 'CNA',
  'rte.ie': 'RTE News',
  'independent.co.uk': 'The Independent',
  'telegraph.co.uk': 'The Telegraph',
  'mirror.co.uk': 'The Mirror',
  'thesun.co.uk': 'The Sun',
  'dailymail.co.uk': 'Daily Mail',
  'irishtimes.com': 'The Irish Times',
  'ft.com': 'Financial Times',
  'economist.com': 'The Economist',
  'time.com': 'TIME',
  'newsweek.com': 'Newsweek',
  'theatlantic.com': 'The Atlantic',
  'newyorker.com': 'The New Yorker',
  'vox.com': 'Vox',
  'slate.com': 'Slate',
  'thedailybeast.com': 'The Daily Beast',
  'nypost.com': 'New York Post',
  'latimes.com': 'Los Angeles Times',
  'scmp.com': 'South China Morning Post',
  'japantimes.co.jp': 'The Japan Times',
  'straitstimes.com': 'The Straits Times',
  'thehindu.com': 'The Hindu',
  'indianexpress.com': 'The Indian Express',
  'smh.com.au': 'The Sydney Morning Herald',
  'lemonde.fr': 'Le Monde',
  'spiegel.de': 'Der Spiegel',
  'electrek.co': 'Electrek',
  'courthousenews.com': 'Courthouse News',
  'reason.com': 'Reason',
  'insidehighered.com': 'Inside Higher Ed',
  'hechingerreport.org': 'The Hechinger Report',
  'edsurge.com': 'EdSurge',
  'housingwire.com': 'HousingWire',
  'bisnow.com': 'Bisnow',
  'artificialintelligence-news.com': 'AI News'
};

/** Longest matching domain suffix wins, so sports.yahoo.com beats yahoo.com. */
function outletFor(host) {
  if (!host) return '';
  let best = '';
  for (const key of Object.keys(OUTLETS)) {
    if ((host === key || host.endsWith('.' + key)) && key.length > best.length) best = key;
  }
  return best ? OUTLETS[best] : '';
}

/** Human-readable source name from a feed's channel/site metadata or its URL. */
function feedTitle(xml, url) {
  const head = xml.slice(0, 4000);
  const t = tagText(head, 'title');
  let clean = toPlainText(t)
    .replace(/\s*[|–—-]\s*(RSS|Feed|News Feed).*$/i, '')
    .trim();
  // "World news | The Guardian" -> "The Guardian"
  if (clean.includes('|')) clean = clean.split('|').pop().trim();
  // "NPR Topics: News" -> "NPR"
  clean = clean.replace(/\s+Topics?:.*$/i, '').trim();
  if (clean && clean.length < 60) return clean;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown';
  }
}

export function parseFeed(xml, feedUrl) {
  const source = feedTitle(xml, feedUrl);
  let host = '';
  try {
    host = new URL(feedUrl).hostname.replace(/^www\./, '');
  } catch {}

  return splitItems(xml)
    .map((item) => {
      // Some newsrooms prefix live-blog items with a coloured dot or emoji.
      const title = toPlainText(tagText(item, 'title'))
        .replace(/^[^\p{L}\p{N}'"“‘(\[]+/u, '')
        .trim();
      if (!title) return null;

      let link = toPlainText(tagText(item, 'link'));
      if (!/^https?:/i.test(link)) link = atomLink(item);
      if (!/^https?:/i.test(link)) link = toPlainText(tagText(item, 'guid'));
      if (!/^https?:/i.test(link)) return null;

      const published = parseDate(
        tagText(item, 'pubDate', 'published', 'updated', 'dc:date', 'date', 'lastBuildDate')
      );
      if (!published) return null;

      const summary = toPlainText(
        tagText(item, 'description', 'summary', 'content:encoded', 'content')
      );

      let linkHost = host;
      try {
        linkHost = new URL(link).hostname.replace(/^www\./, '');
      } catch {}

      const display = outletFor(linkHost) || outletFor(host) || source;

      const rawImage = extractImage(item);
      const image = rawImage ? upgradeImage(rawImage) : '';

      return {
        title,
        link,
        summary: summary.slice(0, 400),
        image,
        // Only set when the URL was rewritten, so the browser has something
        // known-good to retry with if the rewritten variant does not exist.
        imageFallback: image && image !== rawImage ? rawImage : '',
        author: toPlainText(tagText(item, 'dc:creator', 'author', 'name')).slice(0, 80),
        published: published.toISOString(),
        source: display,
        host: linkHost
      };
    })
    .filter(Boolean);
}

/**
 * One retry on a transient failure (DNS hiccup, reset connection, timeout).
 * HTTP status errors are not retried — a 403 will still be a 403.
 */
export async function fetchFeed(url, { timeoutMs = 9000, retries = 1 } = {}) {
  try {
    return await fetchFeedOnce(url, timeoutMs);
  } catch (err) {
    const transient = !/^HTTP \d/.test(err.message);
    if (retries > 0 && transient) {
      await new Promise((r) => setTimeout(r, 700));
      return fetchFeed(url, { timeoutMs, retries: retries - 1 });
    }
    throw err;
  }
}

async function fetchFeedOnce(url, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': UA,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'Accept-Language': 'en'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    if (!/<(item|entry)\b/i.test(xml)) throw new Error('no items in response');
    return parseFeed(xml, url);
  } finally {
    clearTimeout(timer);
  }
}

/** Normalised key used to collapse the same story reported by several outlets. */
export function dedupeKey(article) {
  const t = article.title
    .toLowerCase()
    .replace(/[‘’“”'"]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(the|a|an|of|in|on|to|for|and|as|at|is|are|was|were|with|says|say)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.split(' ').slice(0, 9).join(' ');
}
