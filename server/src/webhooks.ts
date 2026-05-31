import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import type { DayLog } from './dayService.js';
import { getSetting, KEYS } from './settings.js';

const TIMEOUT_MS = 10_000;

export type WebhookEvent =
  | 'dose.due'
  | 'dose.dispensed'
  | 'dose.taken'
  | 'dose.missed'
  | 'person.routine_complete'
  | 'webhook.test';

export type WebhookEnvelope<T> = {
  event: WebhookEvent;
  event_id: string;
  fired_at: string;
  date: string;
  payload: T;
};

type Logger = {
  info(msg: unknown, ...args: unknown[]): void;
  warn(msg: unknown, ...args: unknown[]): void;
  error(msg: unknown, ...args: unknown[]): void;
};

let log: Logger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m),
};

export function setWebhookLogger(l: Logger) {
  log = l;
}

/** Fire-and-forget POST. Logs failures, never throws. */
export async function fireWebhook<T>(
  event: WebhookEvent,
  date: string,
  payload: T
): Promise<void> {
  const url = getSetting(KEYS.webhookUrl);
  if (!url) return;

  const envelope: WebhookEnvelope<T> = {
    event,
    event_id: randomUUID(),
    fired_at: new Date().toISOString(),
    date,
    payload,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      log.warn(
        { event, event_id: envelope.event_id, status: res.status },
        'webhook non-2xx'
      );
    } else {
      log.info({ event, event_id: envelope.event_id }, 'webhook ok');
    }
  } catch (e) {
    log.warn({ event, event_id: envelope.event_id, err: String(e) }, 'webhook failed');
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- payload shapes ---------------- */

export function scheduledDosePayload(log: DayLog) {
  return {
    person: { id: log.person_id, name: log.person_name },
    routine: {
      id: log.routine_id,
      name: log.routine_name,
      scheduled_time: log.due_time,
    },
    medication: {
      id: log.medication_id,
      proper_name: log.med_proper_name,
      brand_name: log.med_brand_name,
      nickname: log.med_nickname,
      dose: log.med_dose,
      dose_size: log.med_dose_size,
      food_timing: log.med_food_timing,
    },
    log: {
      id: log.id,
      due_time: log.due_time,
      missed_window_minutes: log.missed_window_minutes,
      dispensed: log.dispensed === 1,
      dispensed_at: log.dispensed_at,
      dispensed_by: log.dispensed_by,
      taken: log.taken === 1,
      taken_at: log.taken_at,
      outcome: log.outcome,
    },
  };
}

type PrnLogShape = {
  id: number;
  person_id: number;
  medication_id: number;
  assignment_id: number;
  person_name: string;
  med_proper_name: string;
  med_brand_name: string | null;
  med_nickname: string | null;
  med_dose: string;
  med_dose_size: string | null;
  med_food_timing: string;
  dispensed: 0 | 1;
  dispensed_at: string | null;
  dispensed_by: string | null;
  taken_at: string;
};

export function prnDosePayload(p: PrnLogShape) {
  return {
    person: { id: p.person_id, name: p.person_name },
    routine: null,
    medication: {
      id: p.medication_id,
      proper_name: p.med_proper_name,
      brand_name: p.med_brand_name,
      nickname: p.med_nickname,
      dose: p.med_dose,
      dose_size: p.med_dose_size,
      food_timing: p.med_food_timing,
    },
    log: {
      id: p.id,
      kind: 'prn' as const,
      assignment_id: p.assignment_id,
      dispensed: p.dispensed === 1,
      dispensed_at: p.dispensed_at,
      dispensed_by: p.dispensed_by,
      taken_at: p.taken_at,
    },
  };
}

/* ---------------- routine completion ---------------- */

type RoutineCheckRow = {
  count_total: number;
  count_taken: number;
  routine_name: string;
  routine_time: string;
  person_name: string;
};

/** Check whether a scheduled take just completed a person's routine for the
 *  day. Fires `person.routine_complete` once per (date, person, routine).
 *  Away rows are excluded from both numerator and denominator. */
export async function maybeFireRoutineComplete(
  date: string,
  person_id: number,
  routine_id: number
): Promise<void> {
  const row = db
    .prepare<[string, number, number], RoutineCheckRow>(
      `SELECT
          SUM(CASE WHEN outcome IS NOT 'away' THEN 1 ELSE 0 END) AS count_total,
          SUM(CASE WHEN outcome IS NOT 'away' AND taken = 1 THEN 1 ELSE 0 END) AS count_taken,
          MAX(routine_name)  AS routine_name,
          MAX(due_time)      AS routine_time,
          MAX(person_name)   AS person_name
         FROM scheduled_dose_logs
        WHERE date = ? AND person_id = ? AND routine_id = ?`
    )
    .get(date, person_id, routine_id);

  if (!row || row.count_total === 0) return;
  if (row.count_taken !== row.count_total) return;

  const ins = db.prepare(
    `INSERT OR IGNORE INTO routine_completions (date, person_id, routine_id) VALUES (?, ?, ?)`
  );
  const info = ins.run(date, person_id, routine_id);
  if (info.changes === 0) return; // already fired today

  await fireWebhook('person.routine_complete', date, {
    person: { id: person_id, name: row.person_name },
    routine: {
      id: routine_id,
      name: row.routine_name,
      scheduled_time: row.routine_time,
    },
  });
}
