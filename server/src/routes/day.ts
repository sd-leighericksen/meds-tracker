import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import {
  ensureDayLogs,
  getAwayMap,
  getDayLogs,
  nowHHMM,
  todayLocalISO,
  type DayLog,
} from '../dayService.js';
import { reconcile } from '../lifecycle.js';
import { DATE_PATTERN } from '../util.js';

type Person = {
  id: number;
  name: string;
  image: string | null;
  requires_dispense: 0 | 1;
  sort_order: number;
};
type Routine = {
  id: number;
  name: string;
  scheduled_time: string;
  missed_window_minutes: number;
  colour: string | null;
  sort_order: number;
};

export async function dayRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { date?: string } }>(
    '/api/day',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            date: { type: 'string', pattern: DATE_PATTERN },
          },
        },
      },
    },
    async (req) => {
      const date = req.query.date ?? todayLocalISO();
      // On-load/wake reconciliation per brief §5. Cheap and idempotent.
      reconcile();
      ensureDayLogs(date);

      const people = db
        .prepare<[], Person>(
          `SELECT id, name, image, requires_dispense, sort_order
             FROM people ORDER BY sort_order, id`
        )
        .all();
      const routines = db
        .prepare<[], Routine>(
          `SELECT id, name, scheduled_time, missed_window_minutes, colour, sort_order
             FROM routines ORDER BY scheduled_time, sort_order, id`
        )
        .all();
      const logs = getDayLogs(date);
      const awayMap = getAwayMap(date);

      // Active routine = latest scheduled_time <= now; fallback to first.
      const t = nowHHMM();
      let activeRoutineId: number | null = routines[0]?.id ?? null;
      for (const r of routines) {
        if (r.scheduled_time <= t) activeRoutineId = r.id;
      }

      // Medication columns per routine: distinct meds present in the day's
      // logs for that routine, ordered by due_time then name.
      const colsByRoutine = new Map<
        number,
        { medication_id: number; med_proper_name: string; med_nickname: string | null;
          med_brand_name: string | null; med_dose: string; med_dose_size: string | null;
          med_food_timing: string; med_photo_box: string | null; med_photo_tablet: string | null;
          due_time: string }[]
      >();
      for (const r of routines) colsByRoutine.set(r.id, []);
      for (const l of logs) {
        const arr = colsByRoutine.get(l.routine_id)!;
        if (!arr.some((c) => c.medication_id === l.medication_id)) {
          arr.push({
            medication_id: l.medication_id,
            med_proper_name: l.med_proper_name,
            med_brand_name: l.med_brand_name,
            med_nickname: l.med_nickname,
            med_dose: l.med_dose,
            med_dose_size: l.med_dose_size,
            med_food_timing: l.med_food_timing,
            med_photo_box: l.med_photo_box,
            med_photo_tablet: l.med_photo_tablet,
            due_time: l.due_time,
          });
        }
      }
      for (const arr of colsByRoutine.values()) {
        arr.sort((a, b) =>
          a.due_time === b.due_time
            ? a.med_proper_name.localeCompare(b.med_proper_name)
            : a.due_time.localeCompare(b.due_time)
        );
      }

      // Grid: routine -> person -> medication -> log
      const grid: Record<number, Record<number, Record<number, DayLog>>> = {};
      for (const l of logs) {
        (grid[l.routine_id] ??= {});
        (grid[l.routine_id][l.person_id] ??= {});
        grid[l.routine_id][l.person_id][l.medication_id] = l;
      }

      return {
        date,
        now: t,
        active_routine_id: activeRoutineId,
        people: people.map((p) => ({
          ...p,
          requires_dispense: p.requires_dispense === 1,
          away: awayMap.has(p.id),
          away_note: awayMap.get(p.id) ?? null,
        })),
        routines,
        columns_by_routine: Object.fromEntries(colsByRoutine),
        grid,
      };
    }
  );
}
