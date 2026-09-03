# Deploying to Render (free, no credit card)

The repo is committed and ready. Everything below needs *your* accounts, which
is why it is a checklist rather than something already done.

Your actual values are in **`DEPLOY-SECRETS.txt`** in this folder. That file is
git-ignored — do not commit it or paste it anywhere public.

---

## Why this shape

Render's free plan sleeps a service after 15 minutes without traffic. A sleeping
process cannot run a 07:00 timer, so the in-app scheduler alone would never
fire. Instead a free external cron calls a secured webhook each morning: the
request itself wakes the service, which then rebuilds the digest and pushes.

That adds a cold start, so expect the notification at roughly **07:01** rather
than exactly 07:00.

Two things had to change for a host that resets its filesystem on every deploy:

- **VAPID keys now come from environment variables.** A browser's push
  subscription is cryptographically bound to the public key it subscribed with.
  If the server generated a fresh keypair on each deploy, your phone would go
  silent with no error anywhere. Keep these two values stable forever.
- **The app re-asserts its subscription every time it opens.** If a deploy wipes
  the server's subscriber list, opening the app on your phone quietly repairs
  it.

---

## 1. Put the code on GitHub

Create an empty repository at <https://github.com/new> — name it
`daily-digest`, and do **not** let GitHub add a README or .gitignore.

Then, in this folder:

```bash
git remote add origin https://github.com/YOUR-USERNAME/daily-digest.git
git branch -M main
git push -u origin main
```

## 2. Create the Render service

1. Sign up at <https://render.com> (GitHub login is fine, no card required).
2. **New → Web Service**, connect the `daily-digest` repo.
3. Render reads `render.yaml` and fills most of it in. Confirm:
   - Runtime **Node**, Plan **Free**
   - Build command `echo "no dependencies to install"`
   - Start command `node server/index.js`
   - Health check path `/api/health`

## 3. Add the environment variables

In the service's **Environment** tab, add all three from
`DEPLOY-SECRETS.txt`:

| Key | Value |
| --- | --- |
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the base64 blob |
| `BRIEF_SEND_KEY` | the send key |

`BRIEF_TZ` and `BRIEF_HOUR` are already set by `render.yaml`.

Deploy. When it finishes you will have a permanent URL like
`https://daily-digest-xxxx.onrender.com`. Check it:

```bash
curl https://YOUR-APP.onrender.com/api/health
```

## 4. Schedule the morning push

1. Sign up at <https://cron-job.org> (free, no card).
2. **Create cronjob**:
   - URL: the cron URL from `DEPLOY-SECRETS.txt`, with `YOUR-APP` replaced
   - Method: **POST**
   - Schedule: every day at **07:00**
   - Timezone: **Asia/Jerusalem**
   - Timeout: raise it to 60s — a cold start plus fetching 247 feeds is slow
3. Save, then use **Test run** to fire one immediately and confirm your phone
   buzzes.

The endpoint refuses to send twice within an hour, so a cron retry cannot
double-notify you.

## 5. Reinstall the app from the new URL

This step is easy to miss. The app currently on your Home Screen is bound to the
temporary Cloudflare tunnel origin, and a Home Screen app cannot change origin.

1. Delete the old icon.
2. Open `https://YOUR-APP.onrender.com` in **Safari**.
3. **Share → Add to Home Screen → Add**.
4. Open it from the new icon, tap the **bell**, tap **Allow**.

Confirm it registered:

```bash
curl https://YOUR-APP.onrender.com/api/push/key
```

`subscribers` should read `1`. Then stop the tunnel and `npm start` on your PC —
nothing local is needed any more.

---

## What you get

- A permanent https URL that never changes
- The 07:00 briefing arrives with your computer shut
- Free, no card

## What to keep in mind

- **First load after idle is slow.** Render free spins down; opening the app
  after a quiet period takes 30–60 seconds before anything renders.
- **The day-by-day archive resets on each deploy.** Snapshots are written to an
  ephemeral disk. Today's digest is always rebuilt from live feeds, so the app
  works fine — you just lose the ability to page back to previous days after a
  redeploy. A paid disk would fix it; it is not worth $7/month for that alone.
- **Never rotate the VAPID keys** unless you intend to re-enable notifications
  on every device.

## Troubleshooting

Nothing arrives at 07:00:

```bash
# Is the service up, and does it know about your phone?
curl https://YOUR-APP.onrender.com/api/health

# Fire the briefing by hand, exactly as the cron does.
curl -X POST "https://YOUR-APP.onrender.com/api/brief/send?key=YOUR-SEND-KEY"
```

A response of `{"sent":1}` means it reached Apple. `{"sent":0,"failed":1}` means
Apple rejected it — the service log names the reason. `{"skipped":true}` means a
briefing already went out within the hour.

If `subscribers` is `0`, open the app from the Home Screen icon and tap the bell
again.
