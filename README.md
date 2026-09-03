# Daily Digest

A beautiful, installable daily news briefing. **37 topics, 247 sources, today's news only.**

Opens on a one-page morning briefing, and can tap you on the shoulder at 07:00
Jerusalem time when it's ready.

Every story shown was published inside a rolling freshness window (30 hours by
default). Anything older is discarded before it ever reaches the app — there is
no "greatest hits" filler and no evergreen content.

---

## Run it

```bash
npm start
```

That's it. No dependencies, no build step, no API keys — just Node 18+.

```
  Daily Digest
  37 topics · 247 sources · 30h freshness window

  Local:    http://localhost:4173
  Network:  http://192.168.x.x:4173   <- open this on your iPhone/iPad
```

---

## Install it on Apple devices

### iPhone / iPad — the fastest route

1. Run `npm start` on your computer.
2. On your iPhone, connected to the **same Wi-Fi**, open the `Network:` URL in
   **Safari** (it must be Safari — Chrome on iOS cannot install web apps).
3. Tap **Share** → **Add to Home Screen** → **Add**.

You now have a real Home Screen icon. It opens full screen with no browser
chrome, has its own app switcher card, and keeps the last digest readable
offline. The app shows these steps automatically the first time you open it on
an iPhone.

To have it work away from home Wi-Fi, deploy the server anywhere that runs Node
(Render, Railway, Fly.io, a VPS) and install from that URL instead. No code
changes needed — `PORT` is read from the environment.

### macOS — a real `.app` and `.dmg`

The Electron wrapper bundles the server inside the app, so there is nothing to
start by hand.

```bash
npm install --save-dev electron electron-builder
npm run app          # run it locally
npm run build:mac    # produces dist/Daily Digest-1.0.0-universal.dmg
```

**This must be built on a Mac.** `electron-builder` cannot produce a macOS
`.dmg` from Windows — Apple's code-signing and disk-image tooling only exists on
macOS. Copy this folder to a Mac and run the two commands above. The result is a
universal (Apple Silicon + Intel) `.dmg` you can drag into Applications.

Unsigned builds are fine for personal use; macOS asks for a right-click → Open
the first time. Distributing it to other people requires an Apple Developer
account for signing and notarisation.

### macOS — without building anything

Safari and Chrome on macOS can also install it directly: open
`http://localhost:4173`, then **File → Add to Dock** (Safari) or the install
icon in the address bar (Chrome).

---

## What's in it

**37 topics.** Top Stories, **Israel & Palestine**, **Middle East**, World,
**Broadcast**, Politics, United States, United Kingdom, Business, Markets,
Technology, AI, Science, Space, Health, Climate, Energy, Sports, Entertainment,
Arts & Culture, Gaming, Cybersecurity, Crypto, Defence, Law & Justice, Media,
Education, Travel, Food, Style, Autos, Real Estate, plus regional desks for
Africa, Asia, Europe, Latin America and Australia.

**247 feeds from ~110 publications a day.** Wires and papers: BBC, The Guardian,
The New York Times, The Washington Post, NPR, Al Jazeera, The Independent, The
Telegraph, Financial Times, The Economist, TIME, The Atlantic, The New Yorker,
Newsweek, Los Angeles Times, New York Post, The Irish Times, Le Monde, Der
Spiegel, South China Morning Post, The Japan Times, The Straits Times, The
Hindu, The Indian Express, The Sydney Morning Herald.

Broadcasters, in their own **Broadcast** section: BBC, Sky News, CNN-adjacent US
networks (ABC, CBS, NBC, Fox), PBS NewsHour, NPR, Al Jazeera, France 24, DW,
Euronews, CBC, CNA and RTÉ.

**Israel & Palestine** is a dedicated desk, deliberately drawing on all sides:
The Times of Israel, Haaretz, The Jerusalem Post, Israel Hayom, JNS and The
Jewish Press; +972 Magazine, Mondoweiss, The Electronic Intifada and IMEMC
News; Middle East Eye, Middle East Monitor, Al-Monitor, Anadolu Agency and Al
Jazeera; plus the BBC, NYT and Guardian Middle East desks. The **Middle East**
section covers the wider region — the Gulf, Iran, Turkey, Syria and Egypt.

Every topic draws on several independent outlets, so one dead feed never empties
a section.

**Features**

- Editorial layout — a lead story per topic with a supporting column and grid
- Light and dark themes, following the system by default
- Cross-outlet deduplication, with an "also in NPR, BBC News" credit line
- Ranking by recency, corroboration across outlets, and completeness
- **Source diversity**: a prolific wire cannot monopolise a section — each story
  already taken from an outlet makes its next one cost more, so the lead spots
  show a real range of publications
- **Relevance gating**: when a regional desk pulls from a general news wire, the
  story has to actually be about that region
- **Failure-proof**: a build that reaches no feeds (you were offline) is never
  cached and never overwrites the stored digest — the last good one keeps
  showing, flagged as stale. Snapshots merge rather than replace, so a partly
  failing refresh cannot drop stories captured earlier in the day
- Full-text search across the whole digest
- Save stories for later (kept on your device)
- A **day-by-day archive** that builds up as the app runs — each day's digest is
  snapshotted so you can page back through previous days
- Offline: the last digest stays readable, and is clearly labelled as such

---

## The one-page briefing

`#/brief` in the app, or the card at the top of the home screen. It answers
"what happened today" in about a minute:

- **The lead** — the day's biggest story, with its summary and how many
  newsrooms ran it
- **Also leading** — four more, each from a *different* desk, so the top of the
  page is a picture of the day rather than four angles on one situation
- **Israel & Palestine** — its own block, four stories
- **Around the desks** — one headline each from thirteen sections
- **By the numbers** — stories, publications, how many were corroborated, the
  busiest desk, the newest story

Ranking here differs from the main feed: what matters most is **how many
independent newsrooms ran the story**, which is the clearest signal available
that something actually happened rather than one outlet having a quiet
afternoon. Nothing repeats anywhere on the page.

No story appears twice. Cross-outlet dedupe already merges identical wordings;
the briefing additionally rejects near-duplicates by headline-word containment,
which catches the case where two newsrooms describe one event differently —
"Feminist activist and journalist Gloria Steinem dies" and "Gloria Steinem,
groundbreaking feminist campaigner, dies aged 92" are one story, not two.

It is composed, not written: the briefing selects and arranges real headlines
and the publishers' own summaries. It never generates prose, so it cannot
invent a fact, and it needs no API key.

### Getting a copy

**Download one-pager** — on the home screen beside the briefing card, and at the
top of the briefing itself — saves the day's briefing as a single self-contained
HTML file (`daily-digest-2026-09-03.html`, about 13 KB). No stylesheet, no
script, no remote images: everything is inlined, so the saved copy opens
correctly offline, on any device, years from now, with every headline still
linking to its original article. On iPhone it lands in Files.

**Print or save as PDF** uses the browser's own print pipeline, with dedicated
print styles that strip the app furniture.

---

## Morning notifications at 07:00 Jerusalem time

Tap the bell in the toolbar. Each morning the server rebuilds the digest, then
pushes a notification whose text is the actual lead story. Tapping it opens the
briefing.

Change the time with environment variables — the zone is a full IANA name, so
daylight saving is handled for you:

```bash
BRIEF_HOUR=6 BRIEF_MINUTE=30 BRIEF_TZ=Asia/Jerusalem npm start
```

### What this needs

**1. https.** Browsers only allow service workers and the Push API on a secure
origin. `localhost` counts; `http://192.168.x.x` does not — so notifications
will not work over plain http on your home network, and the bell says so when
you tap it. The quickest way to get a real https URL:

```bash
npm start      # terminal 1
npm run tunnel # terminal 2
```

The second prints an `https://….trycloudflare.com` address. Open **that** in
Safari on your iPhone and everything works — including from cellular, not just
your own Wi-Fi.

**The URL changes every time you restart the tunnel.** A home-screen app is
bound to the origin it was installed from, so a new URL means re-adding the app
and re-enabling notifications, and the old icon stops working. Quick tunnels are
fine for trying it out; for something you rely on every morning, deploy the
server to an always-on host instead — the 7am briefing then fires even with your
computer shut.

**2. On iPhone and iPad, the app must be on your Home Screen.** Safari does not
allow web push from a normal browser tab. Add to Home Screen first, open it
from the icon, then enable the bell.

**3. The machine running the server must be awake at 07:00.** It is a plain
Node process, not a cloud service. If the computer is asleep the briefing fires
when it wakes, within a 90-minute grace window; after that it waits for the
next morning. Deploy it somewhere always-on if you want this to be reliable.

### How it works

The server sends a **payload-free push** — a wake-up with no content. The
service worker then fetches the live briefing headline and shows that. This
skips the AES128GCM payload encryption the spec otherwise demands, and has the
better property that the notification always reflects the current briefing
rather than whatever was true when the push was queued.

Signing uses VAPID (ES256 over P-256) via `node:crypto`, with no libraries. The
keypair is generated once into `data/vapid.json` and reused, so subscriptions
survive restarts — **don't delete that file** or every device will need to
re-enable notifications. Subscriptions live in `data/subscriptions.json`;
endpoints the push service reports as gone are dropped automatically.

Send yourself one right now to check it end to end:

```bash
curl -X POST http://localhost:4173/api/push/test
```

---

## A note on images

Feeds advertise the same photo at several sizes, and the order is not helpful:
The Guardian lists 140px, 460px and 700px in that order, so taking the first
match rendered a 140px thumbnail across a 640px card. The parser now picks the
widest variant offered.

Where a CDN will render an arbitrary size, `CDN_UPGRADES` in
[`server/rss.js`](server/rss.js) rewrites the URL — but only per host, and only
where it was checked against the live CDN, because most CDNs sign their URLs.
The Guardian's `i.guim.co.uk` carries an HMAC in `s=` and returns **401** for a
larger `width=`, so 700px is its ceiling. BBC (240 -> 1024) and Haaretz
(108 -> 1200) are unsigned and do upgrade.

The same table caps images that arrive too *large*: NPR ships the full-size
original, one lead measuring 4919px and 3.6 MB, and NYT's biggest renditions run
past 1 MB. Both are brought down to roughly 1024-1200px.

Any rewritten URL is paired with the publisher's original in `imageFallback`. If
the rewritten variant turns out not to exist, the browser retries the original
once before giving up, so a rewrite can never cost a picture that would
otherwise have loaded.

Measured across all 37 desk lead images: none under 400px, none over 800 KB,
none failing to load.

---

## Configuration

Set these as environment variables before `npm start`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4173` | Port to listen on |
| `DIGEST_MAX_AGE_HOURS` | `30` | Freshness window. Nothing older is ever shown. |
| `DIGEST_PER_TOPIC` | `24` | Maximum stories kept per topic |
| `DIGEST_CACHE_MS` | `600000` | How long a built digest is reused (10 min) |
| `DIGEST_DATA_DIR` | `./data` | Where snapshots, VAPID keys and subscriptions live |
| `BRIEF_HOUR` | `7` | Hour to send the morning briefing |
| `BRIEF_MINUTE` | `0` | Minute to send it |
| `BRIEF_TZ` | `Asia/Jerusalem` | IANA zone the time is read in |
| `VAPID_SUBJECT` | `mailto:daily-digest@localhost` | Contact address sent to push services |

A tighter window makes it stricter, at the cost of thinner sections overnight:

```bash
DIGEST_MAX_AGE_HOURS=12 npm start
```

### Adding or removing topics

Everything lives in [`server/feeds.js`](server/feeds.js) — one object per topic
with a label, a blurb, an accent colour and a list of feed URLs. Add any RSS or
Atom feed and it appears in the app on the next refresh.

Check that your feeds are alive at any time:

```bash
npm run check
```

---

## How it works

```
server/feeds.js     topic + feed catalogue
server/rss.js       dependency-free RSS/Atom parser, outlet naming, dedupe keys
server/digest.js    fetch → drop stale → dedupe → rank → cache → snapshot
server/brief.js     composes the one-page briefing
server/brief-html.js renders it as a standalone downloadable file
server/push.js      VAPID web push, no libraries
server/schedule.js  fires the briefing at a wall-clock time in a given zone
server/index.js     static file server + JSON API
public/             the app (vanilla ES modules, no build step)
public/brief.js     the briefing view
public/notify.js    the notification toggle
electron/           macOS .app wrapper
scripts/            feed health check, icon generator
```

**API**

| Endpoint | Returns |
| --- | --- |
| `GET /api/digest` | today's digest (`?refresh=1` to force a rebuild) |
| `GET /api/topics` | the topic catalogue |
| `GET /api/archive` | list of days with stored snapshots |
| `GET /api/archive/2026-09-03` | that day's digest |
| `GET /api/brief` | the one-page briefing (`?day=YYYY-MM-DD` for an archived one) |
| `GET /api/brief/download` | the briefing as a self-contained HTML file attachment |
| `GET /api/brief/notification` | the notification title and body, used by the service worker |
| `GET /api/push/key` | the VAPID public key, subscriber count and next send time |
| `POST /api/push/subscribe` | register a device |
| `POST /api/push/unsubscribe` | remove one |
| `POST /api/push/test` | send a briefing push immediately |
| `GET /api/health` | server status, including the notification schedule |

Feeds are fetched in parallel with a 9-second timeout each and cached for ten
minutes, so a refresh is cheap. Stories reported by multiple outlets are
collapsed into one entry that keeps the richest headline, summary and image, and
credits the other outlets.

Regenerate the icons after changing the artwork in `scripts/make-icons.js`:

```bash
npm run icons
```

---

## Notes

Headlines, summaries and thumbnails come from publishers' own RSS feeds, and
every story links back to the original article. Nothing is rehosted. This is a
personal reader — check each publisher's terms before redistributing it.
