// Renders the briefing as a single self-contained HTML file.
//
// Everything is inlined — no stylesheet, no script, no external images — so the
// downloaded file still opens correctly years later, offline, on any device.

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function longDate(d) {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function clockTime(iso) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function credit(a) {
  const others = a.outlets - 1;
  return others > 0
    ? `${esc(a.source)} <em>+ ${others} more ${others === 1 ? 'outlet' : 'outlets'}</em>`
    : esc(a.source);
}

const STYLE = `
  :root { --ink:#16151b; --muted:#5c5868; --faint:#8a8695; --line:#dedae0; --accent:#4f46e5; }
  * { box-sizing:border-box; }
  body {
    margin:0; padding:44px 32px 60px; background:#fff; color:var(--ink);
    font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .sheet { max-width:760px; margin:0 auto; }
  h1,h2,h3 { font-family:ui-serif,"New York","Iowan Old Style",Palatino,Georgia,"Times New Roman",serif; font-weight:600; letter-spacing:-.022em; }
  a { color:inherit; text-decoration:none; }
  a:hover { text-decoration:underline; text-underline-offset:3px; }
  .eyebrow { margin:0 0 10px; font-size:11.5px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
  h1 { margin:0; font-size:2.4rem; line-height:1.06; }
  .standfirst { margin:12px 0 0; color:var(--muted); font-size:15px; max-width:62ch; }
  .standfirst b { color:var(--ink); font-weight:650; }
  header.head { padding-bottom:22px; border-bottom:2px solid var(--ink); }
  section { padding:24px 0; border-bottom:1px solid var(--line); }
  .kicker { margin:0 0 9px; font-size:11.5px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--accent); }
  h2.lead { margin:0; font-size:1.85rem; line-height:1.18; }
  .lead-summary { margin:12px 0 0; font-size:16px; line-height:1.62; color:#3d3a46; max-width:62ch; }
  h3 { margin:0 0 15px; font-size:1.12rem; display:flex; align-items:center; gap:10px; }
  h3::after { content:""; flex:1; height:1px; background:var(--line); }
  ol,ul { margin:0; padding:0; list-style:none; }
  li { display:flex; gap:12px; align-items:baseline; margin-bottom:14px; }
  li:last-child { margin-bottom:0; }
  .num { flex:none; width:20px; font-family:ui-serif,Georgia,serif; font-size:15px; font-weight:600; color:var(--faint); }
  .dot { flex:none; width:7px; height:7px; margin-top:7px; border-radius:50%; background:var(--accent); align-self:flex-start; }
  .headline { font-family:ui-serif,"New York",Georgia,serif; font-size:1.03rem; font-weight:600; line-height:1.32; letter-spacing:-.012em; display:block; }
  .summary { margin:6px 0 0; font-size:14px; line-height:1.58; color:#3d3a46; }
  .meta { margin:5px 0 0; font-size:12.5px; color:var(--faint); }
  .meta em { font-style:normal; }
  .desks { display:grid; grid-template-columns:repeat(2,1fr); gap:20px 26px; }
  .desk { border-left:2px solid var(--line); padding-left:11px; }
  .desk-name { margin:0 0 5px; font-size:11px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); }
  .numbers { display:grid; grid-template-columns:repeat(5,1fr); gap:12px; }
  .numbers div { display:flex; flex-direction:column; gap:2px; }
  .numbers strong { font-family:ui-serif,Georgia,serif; font-size:1.3rem; font-weight:600; line-height:1.1; }
  .numbers span { font-size:11px; color:var(--faint); }
  footer { padding-top:16px; font-size:12.5px; color:var(--faint); max-width:62ch; border:0; }
  @media (max-width:640px) { .desks,.numbers { grid-template-columns:1fr; } body { padding:26px 18px 40px; } h1 { font-size:1.8rem; } }
  @media print {
    body { padding:0; font-size:11pt; }
    h1 { font-size:21pt; } h2.lead { font-size:15pt; } .headline { font-size:10.5pt; }
    section,li,.desk { break-inside:avoid; }
    .desks { gap:10pt; grid-template-columns:repeat(2,1fr); }
  }
`;

export function briefToHTML(brief) {
  const n = brief.numbers;
  const when = new Date(brief.generatedAt);
  const dateLabel = longDate(when);

  const lead = brief.lead
    ? `<section>
      <p class="kicker">The lead &middot; ${esc(brief.lead.topicLabel)}</p>
      <h2 class="lead"><a href="${esc(brief.lead.link)}">${esc(brief.lead.title)}</a></h2>
      ${brief.lead.summary ? `<p class="lead-summary">${esc(brief.lead.summary)}</p>` : ''}
      <p class="meta">${credit(brief.lead)}</p>
    </section>`
    : '';

  const also = brief.alsoLeading.length
    ? `<section>
      <h3>Also leading</h3>
      <ol>${brief.alsoLeading
        .map(
          (a, i) => `<li>
            <span class="num">${i + 2}</span>
            <div>
              <a class="headline" href="${esc(a.link)}">${esc(a.title)}</a>
              ${a.summary ? `<p class="summary">${esc(a.summary)}</p>` : ''}
              <p class="meta">${credit(a)} &middot; ${esc(a.topicLabel)}</p>
            </div>
          </li>`
        )
        .join('')}</ol>
    </section>`
    : '';

  const focus =
    brief.focus && brief.focus.stories.length
      ? `<section>
        <h3>${esc(brief.focus.label)}</h3>
        <ul>${brief.focus.stories
          .map(
            (a) => `<li>
              <span class="dot"></span>
              <div>
                <a class="headline" href="${esc(a.link)}">${esc(a.title)}</a>
                ${a.summary ? `<p class="summary">${esc(a.summary)}</p>` : ''}
                <p class="meta">${credit(a)}</p>
              </div>
            </li>`
          )
          .join('')}</ul>
      </section>`
      : '';

  const rundown = brief.rundown.length
    ? `<section>
      <h3>Around the desks</h3>
      <div class="desks">${brief.rundown
        .map(
          (r) => `<div class="desk">
            <p class="desk-name">${esc(r.label)}</p>
            <a class="headline" href="${esc(r.story.link)}">${esc(r.story.title)}</a>
            ${r.story.summary ? `<p class="summary">${esc(r.story.summary)}</p>` : ''}
            <p class="meta">${credit(r.story)}</p>
          </div>`
        )
        .join('')}</div>
    </section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Daily Digest — ${esc(dateLabel)}</title>
<style>${STYLE}</style>
</head>
<body>
<div class="sheet">
  <header class="head">
    <p class="eyebrow">Daily Digest &middot; Morning briefing</p>
    <h1>${esc(dateLabel)}</h1>
    <p class="standfirst">
      Everything here was published in the ${brief.windowHours} hours before this briefing was
      compiled. <b>${n.stories}</b> stories from <b>${n.publications}</b> publications across
      <b>${n.topics}</b> desks, compiled at ${esc(clockTime(brief.generatedAt))}.
    </p>
  </header>

  ${lead}
  ${also}
  ${focus}
  ${rundown}

  <section class="numbers">
    <div><strong>${n.stories}</strong><span>stories</span></div>
    <div><strong>${n.publications}</strong><span>publications</span></div>
    <div><strong>${n.corroborated}</strong><span>run by 2+ outlets</span></div>
    <div><strong>${esc(n.busiestDesk)}</strong><span>busiest desk &middot; ${n.busiestCount}</span></div>
    <div><strong>${esc(clockTime(n.newestAt))}</strong><span>newest story</span></div>
  </section>

  <footer>
    Compiled automatically from each publication's own feed. Every headline links to the original
    article; nothing here is rewritten or summarised by machine.
  </footer>
</div>
</body>
</html>
`;
}

/** Filename-safe day key for the download, e.g. daily-digest-2026-09-03.html */
export function briefFilename(brief) {
  const d = new Date(brief.generatedAt);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return `daily-digest-${key}.html`;
}
