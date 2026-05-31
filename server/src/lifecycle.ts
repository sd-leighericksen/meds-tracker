import { db } from './db.js';
import { todayLocalISO } from './dayService.js';

/** Compute taken_on_time vs taken_late from local-clock arithmetic.
 *  Server timezone is the household timezone — Docker should set TZ. */
export function computeTakenOutcome(
  date: string,
  due_time: string,
  missed_window_minutes: number,
  taken_at: string
): 'taken_on_time' | 'taken_late' {
  const due = new Date(`${date}T${due_time}:00`);
  const missedAt = new Date(due.getTime() + missed_window_minutes * 60_000);
  return new Date(taken_at).getTime() <= missedAt.getTime()
    ? 'taken_on_time'
    : 'taken_late';
}

/** Idempotent reconciliation of prior days. Brief §5: "what day is it and what
 *  should today look like is computed on load/wake". Called from GET /api/day
 *  and (in Stage 5) the per-minute scheduler. Safe to call concurrently. */
export function reconcile() {
  const today = todayLocalISO();

  // Stale untaken (and non-away) prior-day rows → missed.
  db.prepare(
    `UPDATE scheduled_dose_logs
        SET outcome = 'missed',
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE date < ?
        AND outcome IS NULL
        AND taken = 0`
  ).run(today);

  // Stale taken prior-day rows that somehow weren't stamped (paranoia path —
  // current take handler stamps inline). Compute outcome row by row.
  const stragglers = db
    .prepare<
      [string],
      {
        id: number;
        date: string;
        due_time: string;
        missed_window_minutes: number;
        taken_at: string;
      }
    >(
      `SELECT id, date, due_time, missed_window_minutes, taken_at
         FROM scheduled_dose_logs
        WHERE date < ?
          AND outcome IS NULL
          AND taken = 1
          AND taken_at IS NOT NULL`
    )
    .all(today);

  const stampOutcome = db.prepare(
    `UPDATE scheduled_dose_logs SET outcome = ?,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id = ?`
  );

  const tx = db.transaction(() => {
    for (const s of stragglers) {
      stampOutcome.run(
        computeTakenOutcome(s.date, s.due_time, s.missed_window_minutes, s.taken_at),
        s.id
      );
    }
  });
  tx();
}
