// Health check: hits every configured feed and reports what works.
// Run with: npm run check
import { TOPICS } from '../server/feeds.js';
import { fetchFeed } from '../server/rss.js';

const maxAgeHours = Number(process.env.DIGEST_MAX_AGE_HOURS || 30);
const cutoff = Date.now() - maxAgeHours * 3.6e6;

const all = TOPICS.flatMap((t) => t.feeds.map((url) => ({ topic: t.id, url })));
const unique = [...new Map(all.map((f) => [f.url, f])).values()];

let ok = 0;
const dead = [];
const stale = [];

async function pool(items, limit, worker) {
  let i = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (i < items.length) await worker(items[i++]);
    })
  );
}

console.log(`Checking ${unique.length} unique feeds across ${TOPICS.length} topics...\n`);

await pool(unique, 10, async ({ topic, url }) => {
  try {
    const items = await fetchFeed(url);
    const fresh = items.filter((a) => Date.parse(a.published) >= cutoff);
    if (fresh.length === 0) {
      stale.push({ topic, url, total: items.length });
      console.log(`  ~  ${String(topic).padEnd(14)} ${items.length} items, 0 fresh  ${url}`);
    } else {
      ok++;
      console.log(`  OK ${String(topic).padEnd(14)} ${String(fresh.length).padStart(3)} fresh  ${url}`);
    }
  } catch (err) {
    dead.push({ topic, url, error: err.message });
    console.log(`  X  ${String(topic).padEnd(14)} ${err.message}  ${url}`);
  }
});

console.log(`\n${ok}/${unique.length} feeds returning fresh items (< ${maxAgeHours}h).`);
if (stale.length) console.log(`${stale.length} reachable but nothing new right now.`);
if (dead.length) {
  console.log(`\n${dead.length} unreachable:`);
  for (const d of dead) console.log(`  ${d.url} — ${d.error}`);
}
