import { db } from './db.js';

export function todayLocalISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowHHMM(now = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Idempotently generate the day's scheduled_dose_log rows from current
 *  assignments. Frozen copies of person/routine/medication details are written
 *  at generation time, per the brief. Away rows are stamped outcome='away'. */
export function ensureDayLogs(date: string) {
  const peopleAway = db
    .prepare<[string, string], { person_id: number }>(
      `SELECT DISTINCT person_id FROM away_periods
        WHERE start_date <= ? AND end_date >= ?`
    )
    .all(date, date);
  const peopleAwayDirect = db
    .prepare<[], { person_id: number }>(
      `SELECT id AS person_id FROM people WHERE is_away = 1`
    )
    .all();
  const awaySet = new Set([
    ...peopleAway.map((r) => r.person_id),
    ...peopleAwayDirect.map((r) => r.person_id),
  ]);

  const candidates = db
    .prepare<
      [string, string],
      {
        assignment_id: number;
        person_id: number;
        routine_id: number;
        medication_id: number;
        time_override: string | null;
        missed_window_override: number | null;
        dose_override: string | null;
        person_name: string;
        routine_name: string;
        routine_time: string;
        routine_missed: number;
        med_proper_name: string;
        med_brand_name: string | null;
        med_nickname: string | null;
        med_dose: string;
        med_dose_size: string | null;
        med_food_timing: string;
        med_photo_box: string | null;
        med_photo_tablet: string | null;
      }
    >(
      `SELECT
         sa.id              AS assignment_id,
         sa.person_id       AS person_id,
         sa.routine_id      AS routine_id,
         sa.medication_id   AS medication_id,
         sa.time_override,
         sa.missed_window_override,
         sa.dose_override,
         p.name             AS person_name,
         r.name             AS routine_name,
         r.scheduled_time   AS routine_time,
         r.missed_window_minutes AS routine_missed,
         m.proper_name      AS med_proper_name,
         m.brand_name       AS med_brand_name,
         m.nickname         AS med_nickname,
         m.dose             AS med_dose,
         m.dose_size        AS med_dose_size,
         m.food_timing      AS med_food_timing,
         m.photo_box        AS med_photo_box,
         m.photo_tablet     AS med_photo_tablet
       FROM scheduled_assignments sa
       JOIN people      p ON p.id = sa.person_id
       JOIN routines    r ON r.id = sa.routine_id
       JOIN medications m ON m.id = sa.medication_id
       WHERE (sa.start_date IS NULL OR sa.start_date <= ?)
         AND (sa.end_date   IS NULL OR sa.end_date   >= ?)`
    )
    .all(date, date);

  const ins = db.prepare(
    `INSERT OR IGNORE INTO scheduled_dose_logs (
        date, person_id, routine_id, medication_id, assignment_id,
        person_name, routine_name,
        med_proper_name, med_brand_name, med_nickname,
        med_dose, med_dose_size, med_food_timing,
        med_photo_box, med_photo_tablet,
        due_time, missed_window_minutes, outcome
      ) VALUES (
        @date, @person_id, @routine_id, @medication_id, @assignment_id,
        @person_name, @routine_name,
        @med_proper_name, @med_brand_name, @med_nickname,
        @med_dose, @med_dose_size, @med_food_timing,
        @med_photo_box, @med_photo_tablet,
        @due_time, @missed_window_minutes, @outcome
      )`
  );

  const tx = db.transaction(() => {
    for (const c of candidates) {
      const away = awaySet.has(c.person_id);
      ins.run({
        date,
        person_id: c.person_id,
        routine_id: c.routine_id,
        medication_id: c.medication_id,
        assignment_id: c.assignment_id,
        person_name: c.person_name,
        routine_name: c.routine_name,
        med_proper_name: c.med_proper_name,
        med_brand_name: c.med_brand_name,
        med_nickname: c.med_nickname,
        med_dose: c.dose_override ?? c.med_dose,
        med_dose_size: c.med_dose_size,
        med_food_timing: c.med_food_timing,
        med_photo_box: c.med_photo_box,
        med_photo_tablet: c.med_photo_tablet,
        due_time: c.time_override ?? c.routine_time,
        missed_window_minutes: c.missed_window_override ?? c.routine_missed,
        outcome: away ? 'away' : null,
      });
    }
  });
  tx();
}

export type DayLog = {
  id: number;
  date: string;
  person_id: number;
  routine_id: number;
  medication_id: number;
  assignment_id: number;
  person_name: string;
  routine_name: string;
  med_proper_name: string;
  med_brand_name: string | null;
  med_nickname: string | null;
  med_dose: string;
  med_dose_size: string | null;
  med_food_timing: string;
  med_photo_box: string | null;
  med_photo_tablet: string | null;
  due_time: string;
  missed_window_minutes: number;
  dispensed: 0 | 1;
  dispensed_at: string | null;
  dispensed_by: string | null;
  taken: 0 | 1;
  taken_at: string | null;
  outcome: 'taken_on_time' | 'taken_late' | 'missed' | 'away' | null;
};

export function getDayLogs(date: string): DayLog[] {
  return db
    .prepare<[string], DayLog>(
      `SELECT * FROM scheduled_dose_logs
        WHERE date = ?
        ORDER BY routine_id, person_id, med_proper_name, id`
    )
    .all(date);
}

export function getAwayMap(date: string): Map<number, string | null> {
  const rows = db
    .prepare<[string, string], { person_id: number; note: string | null }>(
      `SELECT person_id, note FROM away_periods
        WHERE start_date <= ? AND end_date >= ?`
    )
    .all(date, date);
  const m = new Map<number, string | null>();
  for (const r of rows) m.set(r.person_id, r.note);
  // Also include people with is_away toggled on directly.
  const direct = db
    .prepare<[], { id: number; away_note: string | null }>(
      `SELECT id, away_note FROM people WHERE is_away = 1`
    )
    .all();
  for (const p of direct) {
    if (!m.has(p.id)) m.set(p.id, p.away_note);
  }
  return m;
}
