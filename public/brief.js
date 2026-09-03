/* The one-page morning briefing. Designed to be read top to bottom in a minute,
   and to print onto a single sheet. */

import { esc, relTime, longDate, clockTime } from './util.js';

function outletCredit(a) {
  if (a.outlets > 1) {
    const others = a.outlets - 1;
    return `<span class="credit">${esc(a.source)} <em>+ ${others} more ${
      others === 1 ? 'outlet' : 'outlets'
    }</em></span>`;
  }
  return `<span class="credit">${esc(a.source)}</span>`;
}

function metaLine(a, extra = '') {
  return `<p class="brief-meta">${outletCredit(a)}${extra}<span class="sep">·</span> ${relTime(
    a.published
  )}</p>`;
}

function numberedItem(a, index) {
  return `<li class="brief-item">
    <span class="brief-num">${index}</span>
    <div class="brief-item-body">
      <a class="brief-headline" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>
      ${metaLine(a, ` <span class="sep">·</span> ${esc(a.topicLabel)} `)}
    </div>
  </li>`;
}

function bulletItem(a, accent) {
  return `<li class="brief-item">
    <span class="brief-bullet" style="--sec-accent:${esc(accent)}"></span>
    <div class="brief-item-body">
      <a class="brief-headline" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a>
      ${metaLine(a, ' ')}
    </div>
  </li>`;
}

export function renderBrief(brief) {
  const n = brief.numbers;
  const when = new Date(brief.generatedAt);

  const lead = brief.lead
    ? `<section class="brief-lead" style="--sec-accent:${esc(brief.lead.accent || 'var(--accent)')}">
        <p class="brief-kicker">The lead <span class="sep">·</span> ${esc(brief.lead.topicLabel)}</p>
        <h2 class="brief-lead-title">
          <a href="${esc(brief.lead.link)}" target="_blank" rel="noopener noreferrer">${esc(brief.lead.title)}</a>
        </h2>
        ${brief.lead.summary ? `<p class="brief-lead-summary">${esc(brief.lead.summary)}</p>` : ''}
        ${metaLine(brief.lead, ' ')}
      </section>`
    : '';

  const also = brief.alsoLeading.length
    ? `<section class="brief-block">
        <h3 class="brief-h">Also leading</h3>
        <ol class="brief-list">${brief.alsoLeading.map((a, i) => numberedItem(a, i + 2)).join('')}</ol>
      </section>`
    : '';

  const focus =
    brief.focus && brief.focus.stories.length
      ? `<section class="brief-block">
          <h3 class="brief-h" style="--sec-accent:${esc(brief.focus.accent)}">${esc(brief.focus.label)}</h3>
          <ul class="brief-list plain">
            ${brief.focus.stories.map((a) => bulletItem(a, brief.focus.accent)).join('')}
          </ul>
        </section>`
      : '';

  const rundown = brief.rundown.length
    ? `<section class="brief-block">
        <h3 class="brief-h">Around the desks</h3>
        <div class="brief-desks">
          ${brief.rundown
            .map(
              (r) => `<div class="desk" style="--sec-accent:${esc(r.accent)}">
                <p class="desk-name">${esc(r.label)} <span class="desk-count">${r.count}</span></p>
                <a class="desk-story" href="${esc(r.story.link)}" target="_blank" rel="noopener noreferrer">${esc(r.story.title)}</a>
                <p class="brief-meta">${outletCredit(r.story)}</p>
              </div>`
            )
            .join('')}
        </div>
      </section>`
    : '';

  return `<article class="brief">
    <header class="brief-head">
      <p class="brief-eyebrow">Daily Digest <span class="sep">·</span> Morning briefing</p>
      <h1 class="brief-title">${esc(longDate(when))}</h1>
      <p class="brief-standfirst">
        Everything here was published in the last ${brief.windowHours} hours.
        <b>${n.stories}</b> stories from <b>${n.publications}</b> publications across
        <b>${n.topics}</b> desks, compiled at ${esc(clockTime(brief.generatedAt))}.
      </p>
      <div class="brief-actions no-print">
        <a class="text-btn primary" href="/api/brief/download" download>
          <svg viewBox="0 0 24 24" aria-hidden="true" class="btn-glyph"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>
          Download one-pager
        </a>
        <button class="text-btn" data-action="print-brief">Print or save as PDF</button>
        <a class="text-btn" href="#/">Open the full digest →</a>
      </div>
    </header>

    ${lead}
    ${also}
    ${focus}
    ${rundown}

    <section class="brief-numbers">
      <div><strong>${n.stories}</strong><span>stories today</span></div>
      <div><strong>${n.publications}</strong><span>publications</span></div>
      <div><strong>${n.corroborated}</strong><span>run by 2+ outlets</span></div>
      <div><strong>${esc(n.busiestDesk)}</strong><span>busiest desk · ${n.busiestCount}</span></div>
      <div><strong>${esc(clockTime(n.newestAt))}</strong><span>newest story</span></div>
    </section>

    <footer class="brief-foot">
      Compiled automatically from each publication's own feed. Every headline links to the
      original article; nothing here is rewritten or summarised by machine.
    </footer>
  </article>`;
}

export function briefSkeleton() {
  return `<article class="brief">
    <header class="brief-head">
      <div class="skeleton sk-line" style="width:180px"></div>
      <div class="skeleton sk-line" style="width:60%;height:38px;margin-top:16px"></div>
      <div class="skeleton sk-line" style="width:85%"></div>
    </header>
    <section class="brief-lead">
      <div class="skeleton sk-line" style="width:90%;height:30px"></div>
      <div class="skeleton sk-line" style="width:100%"></div>
      <div class="skeleton sk-line" style="width:70%"></div>
    </section>
  </article>`;
}
