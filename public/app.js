/* Daily Digest — client. Vanilla ES modules, no build step. */

import { esc, relTime, isVeryFresh, longDate, greetingFor } from './util.js';
import { renderBrief, briefSkeleton } from './brief.js';
import * as notify from './notify.js';

const $ = (sel) => document.querySelector(sel);
const el = {
  content: $('#content'),
  topicbar: $('#topicbar'),
  dateline: $('#dateline'),
  greeting: $('#greeting'),
  standfirst: $('#standfirst'),
  banner: $('#banner'),
  progress: $('#progress'),
  appbar: $('#appbar'),
  searchbar: $('#searchbar'),
  searchInput: $('#search-input'),
  back: $('#btn-back'),
  refresh: $('#btn-refresh'),
  savedDot: $('#saved-dot'),
  footMeta: $('#foot-meta'),
  daynav: $('#daynav'),
  dayLabel: $('#day-label'),
  dayPrev: $('#day-prev'),
  dayNext: $('#day-next'),
  fab: $('#btn-top'),
  installSheet: $('#install-sheet'),
  bell: $('#btn-bell')
};

const state = {
  digest: null,
  archive: [],
  day: null, // null = live/today
  view: { kind: 'home' }, // home | topic | saved | search | brief
  query: '',
  saved: loadSaved(),
  loading: false,
  brief: null
};

/* ---------------- utilities ---------------- */

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem('dd:saved') || '[]');
  } catch {
    return [];
  }
}
function persistSaved() {
  try {
    localStorage.setItem('dd:saved', JSON.stringify(state.saved.slice(0, 300)));
  } catch {}
  el.savedDot.hidden = state.saved.length === 0;
}

function isSaved(link) {
  return state.saved.some((a) => a.link === link);
}

function toggleSave(article) {
  const i = state.saved.findIndex((a) => a.link === article.link);
  if (i >= 0) state.saved.splice(i, 1);
  else state.saved.unshift({ ...article, savedAt: new Date().toISOString() });
  persistSaved();
}

function allArticles(digest = state.digest) {
  if (!digest) return [];
  const seen = new Set();
  const out = [];
  for (const topic of digest.topics) {
    for (const a of topic.articles) {
      if (seen.has(a.link)) continue;
      seen.add(a.link);
      out.push({ ...a, topicId: topic.id, topicLabel: topic.label, accent: topic.accent });
    }
  }
  return out.sort((x, y) => Date.parse(y.published) - Date.parse(x.published));
}

/* ---------------- rendering ---------------- */

function metaLine(a, accent) {
  const bits = [`<span class="source">${esc(a.source)}</span>`];
  bits.push('<span class="sep">·</span>');
  bits.push(`<time datetime="${esc(a.published)}">${relTime(a.published)}</time>`);
  if (isVeryFresh(a.published)) bits.push('<span class="pill-new">New</span>');
  if (a.alsoIn?.length) {
    const names = a.alsoIn.slice(0, 2).join(', ');
    const more = a.alsoIn.length > 2 ? ` +${a.alsoIn.length - 2}` : '';
    bits.push(`<span class="corroborated">also in ${esc(names)}${esc(more)}</span>`);
  }
  return `<p class="meta" style="--sec-accent:${esc(accent || 'var(--accent)')}">${bits.join(' ')}</p>`;
}

function saveButton(a) {
  const on = isSaved(a.link) ? ' on' : '';
  return `<button class="save-btn${on}" data-save="${esc(a.link)}" aria-label="Save story" title="Save for later">
    <svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg></button>`;
}

/*
 * Some image URLs are rewritten server-side to ask a CDN for a larger or
 * smaller rendition. When that rendition does not exist, retry the publisher's
 * original URL once before giving up, so a rewrite can never cost us a picture
 * that would otherwise have loaded.
 */
function imgTag(src, fallback = '') {
  if (!src) return '';
  const retry = fallback && fallback !== src
    ? `if(this.dataset.retry!=='1'&&this.dataset.fallback){this.dataset.retry='1';this.src=this.dataset.fallback;return;}`
    : '';
  return `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"
    ${fallback ? `data-fallback="${esc(fallback)}"` : ''}
    onerror="${retry}this.closest('.card-media,.lead-media,.row-thumb')?.remove()" />`;
}

function leadCard(a, accent) {
  return `<article class="lead reveal">
    ${saveButton(a)}
    ${a.image ? `<div class="lead-media">${imgTag(a.image, a.imageFallback)}</div>` : ''}
    <div class="lead-body">
      ${metaLine(a, accent)}
      <h3 class="lead-title"><a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a></h3>
      ${a.summary ? `<p class="lead-summary">${esc(a.summary)}</p>` : ''}
    </div>
  </article>`;
}

function rowItem(a, accent) {
  return `<article class="row">
    <div class="row-body">
      ${metaLine(a, accent)}
      <h3 class="row-title"><a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a></h3>
    </div>
    ${a.image ? `<div class="row-thumb">${imgTag(a.image, a.imageFallback)}</div>` : ''}
  </article>`;
}

function gridCard(a, accent) {
  return `<article class="card reveal">
    ${saveButton(a)}
    ${a.image ? `<div class="card-media">${imgTag(a.image, a.imageFallback)}</div>` : ''}
    ${metaLine(a, accent)}
    <h3 class="card-title"><a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a></h3>
    ${a.summary ? `<p class="card-summary">${esc(a.summary)}</p>` : ''}
  </article>`;
}

function sectionHead(topic, withMore = true) {
  return `<header class="section-head" style="--sec-accent:${esc(topic.accent)}">
    <h2 class="section-title">${esc(topic.label)}</h2>
    <p class="section-blurb">${esc(topic.blurb || '')}</p>
    ${withMore ? `<button class="section-more" data-topic="${esc(topic.id)}">All ${topic.articles.length} →</button>` : ''}
  </header>`;
}

function renderHome() {
  const d = state.digest;
  const sections = d.topics.filter((t) => t.articles.length > 0);
  if (!sections.length) return renderEmpty('Nothing new yet', 'No stories came back inside the freshness window. Try refreshing in a few minutes.');

  el.content.innerHTML = sections
    .map((topic, i) => {
      const [lead, ...rest] = topic.articles;
      const column = rest.slice(0, 5).map((a) => rowItem(a, topic.accent)).join('');
      const extra = rest.slice(5, 9);
      return `<section class="section" id="t-${esc(topic.id)}" style="animation-delay:${Math.min(i, 6) * 40}ms">
        ${sectionHead(topic)}
        <div class="lede-grid">
          ${leadCard(lead, topic.accent)}
          <div class="stack">${column}</div>
        </div>
        ${extra.length ? `<div class="card-grid" style="margin-top:30px">${extra.map((a) => gridCard(a, topic.accent)).join('')}</div>` : ''}
      </section>`;
    })
    .join('');
}

function renderTopic(topicId) {
  const topic = state.digest?.topics.find((t) => t.id === topicId);
  if (!topic) return renderEmpty('Topic not found', 'Pick another topic from the bar above.');
  if (!topic.articles.length) {
    return renderEmpty(
      `No fresh ${topic.label.toLowerCase()} stories`,
      `Nothing has been published in this section inside the last ${state.digest.windowHours} hours. Older stories are deliberately not shown.`
    );
  }
  const [lead, ...rest] = topic.articles;
  el.content.innerHTML = `<section class="section">
    ${sectionHead(topic, false)}
    <div class="lede-grid">
      ${leadCard(lead, topic.accent)}
      <div class="stack">${rest.slice(0, 6).map((a) => rowItem(a, topic.accent)).join('')}</div>
    </div>
    ${rest.length > 6 ? `<div class="card-grid" style="margin-top:34px">${rest.slice(6).map((a) => gridCard(a, topic.accent)).join('')}</div>` : ''}
  </section>`;
}

function renderList(title, blurb, articles) {
  if (!articles.length) return renderEmpty(title, blurb);
  el.content.innerHTML = `<section class="section">
    <header class="section-head">
      <h2 class="section-title">${esc(title)}</h2>
      <p class="section-blurb">${esc(blurb)}</p>
    </header>
    <div class="card-grid">${articles.map((a) => gridCard(a, a.accent)).join('')}</div>
  </section>`;
}

function renderEmpty(title, body) {
  el.content.innerHTML = `<div class="empty">
    <h2>${esc(title)}</h2>
    <p>${esc(body)}</p>
    <button class="text-btn" data-action="refresh">Refresh now</button>
  </div>`;
}

function renderSkeleton() {
  const card = `<article class="card">
    <div class="card-media skeleton sk-media"></div>
    <div class="skeleton sk-line" style="width:40%"></div>
    <div class="skeleton sk-line" style="width:92%;height:19px"></div>
    <div class="skeleton sk-line" style="width:70%"></div>
  </article>`;
  el.content.innerHTML = `<section class="section">
    <div class="card-grid">${card.repeat(8)}</div>
  </section>`;
}

/* ---------------- topic bar ---------------- */

function renderTopicBar() {
  const topics = state.digest?.topics || [];
  const current = state.view.kind === 'topic' ? state.view.id : state.view.kind === 'home' ? 'all' : '';
  const chips = [
    `<button class="chip" data-topic="all" aria-pressed="${current === 'all'}"><span class="chip-dot" style="--chip-accent:var(--accent)"></span>All</button>`,
    ...topics
      .filter((t) => t.articles.length)
      .map(
        (t) =>
          `<button class="chip" data-topic="${esc(t.id)}" aria-pressed="${current === t.id}">
            <span class="chip-dot" style="--chip-accent:${esc(t.accent)}"></span>${esc(t.label)}
            </button>`
      )
  ];
  el.topicbar.innerHTML = chips.join('');
  const active = el.topicbar.querySelector('[aria-pressed="true"]');
  active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

/* ---------------- masthead ---------------- */

function renderMasthead() {
  const d = state.digest;
  const isArchive = Boolean(state.day);
  const when = d ? new Date(d.generatedAt) : new Date();

  el.greeting.textContent = isArchive ? 'Archive' : greetingFor();
  el.dateline.textContent = longDate(when);

  if (!d) {
    el.standfirst.textContent = 'Gathering today’s stories…';
    return;
  }

  const sources = new Set(allArticles(d).map((a) => a.source)).size;
  const live = d.health ? `${d.health.feedsOk} of ${d.health.feedsTotal} sources responding` : '';
  el.standfirst.innerHTML =
    `<b>${d.totalArticles}</b> stories across <b>${d.topics.filter((t) => t.articles.length).length}</b> topics from ` +
    `<b>${sources}</b> publications, all published within the last <b>${d.windowHours} hours</b>. ` +
    `Updated ${relTime(d.generatedAt)}.`;

  el.footMeta.textContent =
    `Built ${new Date(d.generatedAt).toLocaleString()} · ${live} · nothing older than ${d.windowHours}h.`;

  // Day navigation appears once an archive exists.
  const days = state.archive;
  el.daynav.hidden = days.length < 2;
  const key = state.day || days[0];
  const idx = days.indexOf(key);
  el.dayLabel.textContent = isArchive ? `Viewing ${key}` : 'Viewing today (live)';
  el.dayPrev.disabled = idx < 0 || idx >= days.length - 1;
  el.dayNext.disabled = !isArchive || idx <= 0;
}

/* ---------------- data ---------------- */

function setLoading(on) {
  state.loading = on;
  el.progress.hidden = !on;
  el.refresh.classList.toggle('spinning', on);
}

function showBanner(msg, kind = '') {
  if (!msg) {
    el.banner.hidden = true;
    return;
  }
  el.banner.className = `banner ${kind}`;
  el.banner.textContent = msg;
  el.banner.hidden = false;
}

let buildPollTimer = null;

function scheduleBuildPoll() {
  if (buildPollTimer) return;
  buildPollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') loadDigest();
  }, 6000);
}

function stopBuildPoll() {
  if (buildPollTimer) clearInterval(buildPollTimer);
  buildPollTimer = null;
}

async function loadDigest({ force = false } = {}) {
  setLoading(true);
  if (!state.digest) renderSkeleton();
  try {
    const url = state.day ? `/api/archive/${state.day}` : `/api/digest${force ? '?refresh=1' : ''}`;
    const res = await fetch(url, { cache: 'no-store' });

    // 202 means the server is still assembling the digest. On a small host that
    // takes a minute or two from cold, so check back rather than sitting on an
    // empty skeleton forever.
    if (res.status === 202) {
      const info = await res.json().catch(() => ({}));
      const seconds = Math.round((info.buildingForMs || 0) / 1000);
      showBanner(
        `Gathering today's stories from 210 sources${seconds > 5 ? ` — ${seconds}s so far` : ''}. This takes a minute or two on first load.`
      );
      setLoading(false);
      scheduleBuildPoll();
      return;
    }

    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    state.digest = await res.json();
    stopBuildPoll();
    showBanner(res.headers.get('X-Digest-Building') === 'true' ? 'Refreshing in the background…' : '');
  } catch (err) {
    if (state.digest) {
      showBanner('Could not reach the server — showing the last digest loaded.', 'warn');
    } else {
      setLoading(false);
      renderEmpty(
        'Can’t reach the digest server',
        'Make sure it is running (npm start), then try again. ' + (err?.message || '')
      );
      return;
    }
  }
  setLoading(false);
  renderTopicBar();
  renderMasthead();
  route();
}

async function loadBrief() {
  try {
    const res = await fetch('/api/brief', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    state.brief = await res.json();
    if (state.view.kind === 'brief') el.content.innerHTML = renderBrief(state.brief);
  } catch (err) {
    if (state.view.kind !== 'brief') return;
    renderEmpty(
      'Could not build the briefing',
      err?.message || 'The server did not respond. Make sure it is running.'
    );
  }
}

/* ---------------- morning notifications ---------------- */

async function refreshBell() {
  const on = await notify.isEnabled();
  // Repairs the server's subscriber list if a redeploy wiped it.
  if (on) notify.resync();
  el.bell.classList.toggle('on', on);
  el.bell.setAttribute(
    'aria-label',
    on ? 'Morning briefing notifications are on' : 'Get the morning briefing at 7am'
  );
  el.bell.title = on
    ? 'Morning briefing: on'
    : 'Get a notification each morning at 07:00 Jerusalem time';
}

async function toggleNotifications() {
  if (!notify.pushSupported()) {
    showBanner(notify.unavailableReason(), 'warn');
    return;
  }
  try {
    if (await notify.isEnabled()) {
      await notify.disable();
      showBanner('Morning briefing notifications turned off.');
    } else {
      const schedule = await notify.enable();
      const next = schedule?.next || 'tomorrow at 07:00 Asia/Jerusalem';
      showBanner(`Morning briefing on. Next one arrives ${next}.`);
    }
    setTimeout(() => showBanner(''), 6000);
  } catch (err) {
    showBanner(err?.message || 'Could not change the notification setting.', 'warn');
  }
  refreshBell();
}

async function loadArchive() {
  try {
    const res = await fetch('/api/archive', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    state.archive = data.days || [];
    renderMasthead();
  } catch {}
}

/* ---------------- routing ---------------- */

function route() {
  if (!state.digest) return;
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean);

  if (parts[0] === 'brief') {
    state.view = { kind: 'brief' };
    el.content.innerHTML = state.brief ? renderBrief(state.brief) : briefSkeleton();
    loadBrief();
  } else if (parts[0] === 't' && parts[1]) {
    state.view = { kind: 'topic', id: parts[1] };
    renderTopic(parts[1]);
  } else if (parts[0] === 'saved') {
    state.view = { kind: 'saved' };
    renderList(
      'Saved stories',
      state.saved.length ? `${state.saved.length} kept for later.` : 'Tap the bookmark on any story to keep it here.',
      state.saved
    );
  } else {
    state.view = { kind: 'home' };
    renderHome();
  }

  el.back.hidden = state.view.kind === 'home';
  document.body.classList.toggle('reading-brief', state.view.kind === 'brief');
  renderTopicBar();
  document.title =
    state.view.kind === 'topic'
      ? `${state.digest.topics.find((t) => t.id === state.view.id)?.label || 'Topic'} · Daily Digest`
      : state.view.kind === 'brief'
        ? 'Morning briefing · Daily Digest'
        : 'Daily Digest';
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function runSearch(q) {
  state.query = q;
  const needle = q.trim().toLowerCase();
  if (!needle) {
    renderList('Search', 'Type to search across every topic in today’s digest.', []);
    return;
  }
  const hits = allArticles().filter(
    (a) =>
      a.title.toLowerCase().includes(needle) ||
      a.summary.toLowerCase().includes(needle) ||
      a.source.toLowerCase().includes(needle) ||
      a.topicLabel.toLowerCase().includes(needle)
  );
  state.view = { kind: 'search' };
  el.back.hidden = false;
  renderList(
    `“${q}”`,
    hits.length ? `${hits.length} matching ${hits.length === 1 ? 'story' : 'stories'} in today’s digest.` : 'No matches in today’s digest.',
    hits.slice(0, 120)
  );
}

/* ---------------- theme ---------------- */

function applyTheme(mode) {
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
  try {
    localStorage.setItem('dd:theme', mode);
  } catch {}
}

function currentTheme() {
  const stored = (() => {
    try {
      return localStorage.getItem('dd:theme');
    } catch {
      return null;
    }
  })();
  return stored || 'system';
}

function isDarkNow() {
  const t = currentTheme();
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

/* ---------------- events ---------------- */

document.addEventListener('click', (e) => {
  const saveBtn = e.target.closest('[data-save]');
  if (saveBtn) {
    e.preventDefault();
    const link = saveBtn.getAttribute('data-save');
    const article = allArticles().find((a) => a.link === link) || state.saved.find((a) => a.link === link);
    if (article) {
      toggleSave(article);
      saveBtn.classList.toggle('on', isSaved(link));
      if (state.view.kind === 'saved') route();
    }
    return;
  }

  const chip = e.target.closest('[data-topic]');
  if (chip) {
    const id = chip.getAttribute('data-topic');
    location.hash = id === 'all' ? '#/' : `#/t/${id}`;
    return;
  }

  if (e.target.closest('[data-action="refresh"]')) {
    loadDigest({ force: true });
  }

  if (e.target.closest('[data-action="print-brief"]')) {
    window.print();
  }
});

el.bell.addEventListener('click', toggleNotifications);

el.refresh.addEventListener('click', () => {
  if (state.loading) return;
  state.day = null;
  loadDigest({ force: true }).then(loadArchive);
});

el.back.addEventListener('click', () => {
  el.searchbar.hidden = true;
  location.hash = '#/';
  route();
});

$('#btn-theme').addEventListener('click', () => applyTheme(isDarkNow() ? 'light' : 'dark'));

$('#btn-saved').addEventListener('click', () => {
  location.hash = '#/saved';
});

$('#btn-search').addEventListener('click', () => {
  const showing = !el.searchbar.hidden;
  el.searchbar.hidden = showing;
  if (!showing) el.searchInput.focus();
});

$('#search-close').addEventListener('click', () => {
  el.searchbar.hidden = true;
  el.searchInput.value = '';
  location.hash = '#/';
  route();
});

let searchTimer;
el.searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(() => runSearch(v), 140);
});

el.dayPrev.addEventListener('click', () => {
  const days = state.archive;
  const idx = days.indexOf(state.day || days[0]);
  const next = days[idx + 1];
  if (next) {
    state.day = next;
    loadDigest();
  }
});

el.dayNext.addEventListener('click', () => {
  const days = state.archive;
  const idx = days.indexOf(state.day || days[0]);
  const prev = days[idx - 1];
  state.day = prev && prev !== days[0] ? prev : null;
  loadDigest();
});

window.addEventListener('hashchange', route);

el.fab.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

let lastScroll = 0;
window.addEventListener(
  'scroll',
  () => {
    const y = window.scrollY;
    el.appbar.classList.toggle('scrolled', y > 8);
    el.fab.classList.toggle('show', y >= 700);
    lastScroll = y;
  },
  { passive: true }
);

// Refresh quietly when the app comes back to the foreground and data is stale.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || state.day || !state.digest) return;
  const age = Date.now() - Date.parse(state.digest.generatedAt);
  if (age > 12 * 60 * 1000) loadDigest();
});

setInterval(() => {
  if (document.visibilityState === 'visible' && !state.day) loadDigest();
}, 15 * 60 * 1000);

/* ---------------- install hint (iOS Safari) ---------------- */

function maybeShowInstallHint() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true ||
    matchMedia('(display-mode: standalone)').matches;
  let dismissed = false;
  try {
    dismissed = localStorage.getItem('dd:install-dismissed') === '1';
  } catch {}
  if (isIOS && !standalone && !dismissed) {
    setTimeout(() => {
      el.installSheet.hidden = false;
    }, 2600);
  }
}

$('#install-close').addEventListener('click', () => {
  el.installSheet.hidden = true;
  try {
    localStorage.setItem('dd:install-dismissed', '1');
  } catch {}
});
el.installSheet.addEventListener('click', (e) => {
  if (e.target === el.installSheet) el.installSheet.hidden = true;
});

/* ---------------- boot ---------------- */

applyTheme(currentTheme());
persistSaved();
renderMasthead();
maybeShowInstallHint();
loadDigest().then(loadArchive);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(refreshBell)
      .catch(() => {
        // No service worker (usually plain http on a LAN address) means no
        // push either; the bell explains why when tapped.
        refreshBell();
      });
  });
} else {
  refreshBell();
}
