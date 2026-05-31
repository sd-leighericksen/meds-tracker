import { db } from './db.js';
import { todayLocalISO, type DayLog } from './dayService.js';
import { reconcile } from './lifecycle.js';
import {
  fireWebhook,
  scheduledDosePayload,
  setWebhookLogger,
} from './webhooks.js';

const TICK_MS = 60_000;

let running = false;
let timer: NodeJS.Timeout | null = null;

type LogRow = DayLog;

function localMsFromDate(date: string, hhmm: string): number {
  // Local-clock arithmetic to match brief and the cell-state derivation.
  return new Date(`${date}T${hhmm}:00`).getTime();
}

const markDueFired = db.prepare(
  `UPDATE scheduled_dose_logs SET webhook_due_fired = 1 WHERE id = ?`
);
const markMissedFired = db.prepare(
  `UPDATE scheduled_dose_logs SET webhook_missed_fired = 1,
                                  outcome = 'missed',
                                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE id = ?`
);

/** Single tick. Public so tests / dev can invoke it without waiting 60s. */
export async function tickOnce(): Promise<void> {
  if (running) return;
  running = true;
  try {
    reconcile();

    const today = todayLocalISO();
    const nowMs = Date.now();

    // dose.due: any of today's logs whose due time has been reached, with the
    // due webhook not yet fired, and the person not away. Brief §9 + open item.
    const dueCandidates = db
      .prepare<[string], LogRow>(
        `SELECT * FROM scheduled_dose_logs
          WHERE date = ?
            AND webhook_due_fired = 0
            AND (outcome IS NULL OR outcome != 'away')`
      )
      .all(today);

    for (const log of dueCandidates) {
      if (nowMs >= localMsFromDate(log.date, log.due_time)) {
        await fireWebhook('dose.due', log.date, scheduledDosePayload(log));
        markDueFired.run(log.id);
      }
    }

    // dose.missed: missed_window has elapsed, dose untaken, person not away.
    const missedCandidates = db
      .prepare<[string], LogRow>(
        `SELECT * FROM scheduled_dose_logs
          WHERE date = ?
            AND webhook_missed_fired = 0
            AND taken = 0
            AND (outcome IS NULL OR outcome != 'away')`
      )
      .all(today);

    for (const log of missedCandidates) {
      const missedAt =
        localMsFromDate(log.date, log.due_time) +
        log.missed_window_minutes * 60_000;
      if (nowMs >= missedAt) {
        markMissedFired.run(log.id);
        // Re-read so the payload reflects outcome='missed'.
        const fresh = db
          .prepare<[number], LogRow>(`SELECT * FROM scheduled_dose_logs WHERE id = ?`)
          .get(log.id);
        if (fresh) {
          await fireWebhook('dose.missed', fresh.date, scheduledDosePayload(fresh));
        }
      }
    }
  } finally {
    running = false;
  }
}

export function startScheduler(logger: {
  info(msg: unknown, ...args: unknown[]): void;
  warn(msg: unknown, ...args: unknown[]): void;
  error(msg: unknown, ...args: unknown[]): void;
}) {
  setWebhookLogger(logger);
  if (timer) return;
  // Fire once shortly after boot so wake/reconnect is fast, then on cadence.
  setTimeout(() => {
    tickOnce().catch((e) => logger.error({ err: String(e) }, 'tick failed'));
  }, 2_000);
  timer = setInterval(() => {
    tickOnce().catch((e) => logger.error({ err: String(e) }, 'tick failed'));
  }, TICK_MS);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
