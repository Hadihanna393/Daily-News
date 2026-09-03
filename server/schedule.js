// Fires a callback once a day at a given wall-clock time in a given zone.
//
// Rather than computing "milliseconds until 07:00" — which goes wrong across a
// daylight-saving change, and Israel shifts its clocks — this reads the actual
// local time in the zone once a minute and fires when it first sees the target
// hour. A per-day key makes sure it fires once even if the check runs twice in
// the same minute or the clock jumps.

const CHECK_INTERVAL_MS = 60 * 1000;

export function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(date);

  const out = {};
  for (const p of parts) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  // Intl renders midnight as hour 24 in some ICU versions.
  if (out.hour === 24) out.hour = 0;
  return out;
}

export function zonedDayKey(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Human-readable "next fire" for logging and the API. */
export function describeNext(hour, minute, timeZone, lastKey) {
  const now = new Date();
  const p = zonedParts(now, timeZone);
  const past = p.hour > hour || (p.hour === hour && p.minute >= minute);
  const alreadyToday = lastKey === zonedDayKey(now, timeZone);
  const when = past || alreadyToday ? 'tomorrow' : 'today';
  return `${when} at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${timeZone}`;
}

export class DailyTask {
  /**
   * @param {object} options
   * @param {number} options.hour     Local hour to fire at, 0-23.
   * @param {number} [options.minute] Local minute, default 0.
   * @param {string} options.timeZone IANA zone, e.g. "Asia/Jerusalem".
   * @param {number} [options.graceMinutes] How long after the target the task
   *   may still fire — covers a laptop that was asleep at the exact minute.
   * @param {Function} options.run
   */
  constructor({ hour, minute = 0, timeZone, graceMinutes = 90, run }) {
    Object.assign(this, { hour, minute, timeZone, graceMinutes, run });
    this.lastRunKey = null;
    this.lastRunAt = null;
    this.lastResult = null;
    this.timer = null;
  }

  start() {
    // Anything already past today counts as done, so starting the server in the
    // afternoon does not immediately fire the morning briefing.
    this.lastRunKey = this.isWithinWindow(new Date()) ? null : zonedDayKey(new Date(), this.timeZone);
    if (this.dueNow(new Date())) this.lastRunKey = null;

    this.timer = setInterval(() => this.tick(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
    return this;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  isWithinWindow(date) {
    const p = zonedParts(date, this.timeZone);
    const target = this.hour * 60 + this.minute;
    const current = p.hour * 60 + p.minute;
    return current >= target && current <= target + this.graceMinutes;
  }

  dueNow(date) {
    return this.isWithinWindow(date) && zonedDayKey(date, this.timeZone) !== this.lastRunKey;
  }

  async tick() {
    const now = new Date();
    if (!this.dueNow(now)) return;

    this.lastRunKey = zonedDayKey(now, this.timeZone);
    this.lastRunAt = now.toISOString();
    try {
      this.lastResult = await this.run();
    } catch (err) {
      this.lastResult = { error: err?.message || String(err) };
      console.warn('[schedule] daily task failed:', err?.message || err);
    }
  }

  /** Force a run now, without disturbing the daily schedule. */
  async runNow() {
    this.lastRunAt = new Date().toISOString();
    this.lastResult = await this.run();
    return this.lastResult;
  }

  status() {
    return {
      timeZone: this.timeZone,
      at: `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`,
      next: describeNext(this.hour, this.minute, this.timeZone, this.lastRunKey),
      lastRunAt: this.lastRunAt,
      lastResult: this.lastResult
    };
  }
}
