import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { requirePin } from '../auth.js';
import { todayLocalISO, type DayLog } from '../dayService.js';
import { DATE_PATTERN } from '../util.js';

type GroupBy = 'person' | 'medication' | 'routine';

type GroupRow = {
  group_id: number;
  group_name: string;
  taken_on_time: number;
  taken_late: number;
  missed: number;
  away: number;
  pending: number;
  scheduled: number;
  total: number;
};

function daysAgoLocalISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function groupQuery(by: GroupBy): string {
  const idCol =
    by === 'person' ? 'person_id' : by === 'medication' ? 'medication_id' : 'routine_id';
  const nameCol =
    by === 'person'
      ? 'person_name'
      : by === 'medication'
        ? 'med_proper_name'
        : 'routine_name';
  return `
    SELECT
      ${idCol}                                                            AS group_id,
      MAX(${nameCol})                                                     AS group_name,
      SUM(CASE WHEN outcome = 'taken_on_time'                THEN 1 ELSE 0 END) AS taken_on_time,
      SUM(CASE WHEN outcome = 'taken_late'                   THEN 1 ELSE 0 END) AS taken_late,
      SUM(CASE WHEN outcome = 'missed'                       THEN 1 ELSE 0 END) AS missed,
      SUM(CASE WHEN outcome = 'away'                         THEN 1 ELSE 0 END) AS away,
      SUM(CASE WHEN outcome IS NULL                          THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN outcome IS NULL OR outcome != 'away'     THEN 1 ELSE 0 END) AS scheduled,
      COUNT(*)                                                                 AS total
    FROM scheduled_dose_logs
    WHERE date >= ? AND date <= ?
    GROUP BY ${idCol}
    ORDER BY group_name
  `;
}

export async function reportingRoutes(app: FastifyInstance) {
  // Delete all dose logs — full reset. Irreversible; requires PIN.
  app.delete(
    '/api/reporting/reset',
    { preHandler: requirePin },
    async (_req, reply) => {
      db.prepare('DELETE FROM scheduled_dose_logs').run();
      db.prepare('DELETE FROM prn_dose_logs').run();
      db.prepare('DELETE FROM routine_completions').run();
      reply.code(204).send();
    }
  );

  // Summary across a rolling N-day window.
  app.get<{ Querystring: { window?: string; until?: string } }>(
    '/api/reporting/summary',
    {
      preHandler: requirePin,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            window: { type: 'string', enum: ['7', '30'] },
            until: { type: 'string', pattern: DATE_PATTERN },
          },
        },
      },
    },
    async (req) => {
      const window = req.query.window === '30' ? 30 : 7;
      const until = req.query.until ?? todayLocalISO();
      const since = daysAgoLocalISO(window - 1);
      const by_person = db
        .prepare<[string, string], GroupRow>(groupQuery('person'))
        .all(since, until);
      const by_medication = db
        .prepare<[string, string], GroupRow>(groupQuery('medication'))
        .all(since, until);
      const by_routine = db
        .prepare<[string, string], GroupRow>(groupQuery('routine'))
        .all(since, until);
      return { window, since, until, by_person, by_medication, by_routine };
    }
  );

  // Full household day log: scheduled + PRN for a single date.
  app.get<{ Querystring: { date?: string } }>(
    '/api/reporting/day',
    {
      preHandler: requirePin,
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
      const scheduled = db
        .prepare<[string], DayLog>(
          `SELECT * FROM scheduled_dose_logs
            WHERE date = ?
            ORDER BY person_name, due_time, med_proper_name`
        )
        .all(date);
      const prn = db
        .prepare<[string], unknown>(
          `SELECT * FROM prn_dose_logs
            WHERE date = ?
            ORDER BY taken_at`
        )
        .all(date);
      return { date, scheduled, prn };
    }
  );

  // PRN history window, grouped by (person, medication).
  app.get<{ Querystring: { days?: string } }>(
    '/api/reporting/prn-history',
    {
      preHandler: requirePin,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            days: { type: 'string', enum: ['7', '30', '90'] },
          },
        },
      },
    },
    async (req) => {
      const days = req.query.days === '30' ? 30 : req.query.days === '90' ? 90 : 7;
      const since = daysAgoLocalISO(days - 1);
      const until = todayLocalISO();

      type PrnRow = {
        id: number;
        date: string;
        person_id: number;
        person_name: string;
        medication_id: number;
        med_proper_name: string;
        med_brand_name: string | null;
        med_dose: string;
        med_dose_size: string | null;
        taken_at: string;
        dispensed: 0 | 1;
        dispensed_by: string | null;
      };
      const rows = db
        .prepare<[string, string], PrnRow>(
          `SELECT id, date, person_id, person_name,
                  medication_id, med_proper_name, med_brand_name,
                  med_dose, med_dose_size,
                  taken_at, dispensed, dispensed_by
             FROM prn_dose_logs
            WHERE date >= ? AND date <= ?
            ORDER BY taken_at DESC`
        )
        .all(since, until);

      // Group by (person_id, medication_id), preserving order of first appearance.
      const map = new Map<
        string,
        {
          person_id: number;
          person_name: string;
          medication_id: number;
          med_proper_name: string;
          med_brand_name: string | null;
          med_dose: string;
          med_dose_size: string | null;
          count: number;
          last_taken_at: string | null;
          logs: PrnRow[];
        }
      >();
      for (const r of rows) {
        const k = `${r.person_id}:${r.medication_id}`;
        const cur = map.get(k);
        if (cur) {
          cur.count += 1;
          cur.logs.push(r);
        } else {
          map.set(k, {
            person_id: r.person_id,
            person_name: r.person_name,
            medication_id: r.medication_id,
            med_proper_name: r.med_proper_name,
            med_brand_name: r.med_brand_name,
            med_dose: r.med_dose,
            med_dose_size: r.med_dose_size,
            count: 1,
            last_taken_at: r.taken_at,
            logs: [r],
          });
        }
      }

      return {
        since,
        until,
        days,
        groups: [...map.values()].sort((a, b) =>
          a.person_name === b.person_name
            ? a.med_proper_name.localeCompare(b.med_proper_name)
            : a.person_name.localeCompare(b.person_name)
        ),
      };
    }
  );
}
