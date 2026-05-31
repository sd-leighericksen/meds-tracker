import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { DATE_PATTERN } from '../util.js';
import { todayLocalISO } from '../dayService.js';
import { fireWebhook, prnDosePayload } from '../webhooks.js';

type AssignmentJoin = {
  id: number;
  person_id: number;
  medication_id: number;
  dose_override: string | null;
  max_per_day: number;
  min_interval_hours: number;
  start_date: string | null;
  end_date: string | null;
  person_name: string;
  person_requires_dispense: 0 | 1;
  med_proper_name: string;
  med_brand_name: string | null;
  med_nickname: string | null;
  med_dose: string;
  med_dose_size: string | null;
  med_food_timing: string;
  med_photo_box: string | null;
  med_photo_tablet: string | null;
};

type PrnLog = {
  id: number;
  date: string;
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
  med_photo_box: string | null;
  med_photo_tablet: string | null;
  dispensed: 0 | 1;
  dispensed_at: string | null;
  dispensed_by: string | null;
  taken_at: string;
  created_at: string;
};

export async function prnDoseLogsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { date?: string } }>(
    '/api/prn-today',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { date: { type: 'string', pattern: DATE_PATTERN } },
        },
      },
    },
    async (req) => {
      const date = req.query.date ?? todayLocalISO();
      const assignments = db
        .prepare<[string, string], AssignmentJoin>(
          `SELECT pa.id, pa.person_id, pa.medication_id, pa.dose_override,
                  pa.max_per_day, pa.min_interval_hours, pa.start_date, pa.end_date,
                  p.name AS person_name, p.requires_dispense AS person_requires_dispense,
                  m.proper_name AS med_proper_name, m.brand_name AS med_brand_name,
                  m.nickname AS med_nickname, m.dose AS med_dose, m.dose_size AS med_dose_size,
                  m.food_timing AS med_food_timing,
                  m.photo_box AS med_photo_box, m.photo_tablet AS med_photo_tablet
             FROM prn_assignments pa
             JOIN people p      ON p.id = pa.person_id
             JOIN medications m ON m.id = pa.medication_id
            WHERE (pa.start_date IS NULL OR pa.start_date <= ?)
              AND (pa.end_date   IS NULL OR pa.end_date   >= ?)
            ORDER BY pa.person_id, m.proper_name`
        )
        .all(date, date);

      const todayLogs = db
        .prepare<[string], PrnLog>(
          `SELECT * FROM prn_dose_logs WHERE date = ? ORDER BY taken_at`
        )
        .all(date);

      // last_taken_at across all dates (for the soft interval notice on rollovers).
      const lastAcrossAll = db
        .prepare<
          [number, number],
          { taken_at: string }
        >(
          `SELECT MAX(taken_at) AS taken_at
             FROM prn_dose_logs
            WHERE person_id = ? AND medication_id = ?`
        );

      return {
        date,
        items: assignments.map((a) => {
          const todayItems = todayLogs.filter(
            (l) => l.person_id === a.person_id && l.medication_id === a.medication_id
          );
          const last = lastAcrossAll.get(a.person_id, a.medication_id);
          return {
            assignment_id: a.id,
            person_id: a.person_id,
            person_name: a.person_name,
            person_requires_dispense: a.person_requires_dispense === 1,
            medication_id: a.medication_id,
            med: {
              proper_name: a.med_proper_name,
              brand_name: a.med_brand_name,
              nickname: a.med_nickname,
              dose: a.dose_override ?? a.med_dose,
              dose_size: a.med_dose_size,
              food_timing: a.med_food_timing,
              photo_box: a.med_photo_box,
              photo_tablet: a.med_photo_tablet,
            },
            max_per_day: a.max_per_day,
            min_interval_hours: a.min_interval_hours,
            taken_today: todayItems.length,
            last_taken_at: last?.taken_at ?? null,
            today_logs: todayItems,
          };
        }),
      };
    }
  );

  app.post<{
    Body: {
      person_id?: number;
      medication_id?: number;
      assignment_id?: number;
      dispensed?: boolean;
      dispensed_by?: string | null;
    };
  }>(
    '/api/prn-dose-logs',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['assignment_id'],
          properties: {
            assignment_id: { type: 'integer', minimum: 1 },
            person_id: { type: 'integer', minimum: 1 },
            medication_id: { type: 'integer', minimum: 1 },
            dispensed: { type: 'boolean' },
            dispensed_by: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 40 }] },
          },
        },
      },
    },
    async (req, reply) => {
      const b = req.body;
      const join = db
        .prepare<
          [number],
          AssignmentJoin
        >(
          `SELECT pa.id, pa.person_id, pa.medication_id, pa.dose_override,
                  pa.max_per_day, pa.min_interval_hours, pa.start_date, pa.end_date,
                  p.name AS person_name, p.requires_dispense AS person_requires_dispense,
                  m.proper_name AS med_proper_name, m.brand_name AS med_brand_name,
                  m.nickname AS med_nickname, m.dose AS med_dose, m.dose_size AS med_dose_size,
                  m.food_timing AS med_food_timing,
                  m.photo_box AS med_photo_box, m.photo_tablet AS med_photo_tablet
             FROM prn_assignments pa
             JOIN people p      ON p.id = pa.person_id
             JOIN medications m ON m.id = pa.medication_id
            WHERE pa.id = ?`
        )
        .get(b.assignment_id!);
      if (!join) return reply.code(404).send({ error: 'assignment not found' });

      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const requires = join.person_requires_dispense === 1;
      const dispensed = b.dispensed ?? requires;

      const info = db
        .prepare(
          `INSERT INTO prn_dose_logs (
              date, person_id, medication_id, assignment_id,
              person_name, med_proper_name, med_brand_name, med_nickname,
              med_dose, med_dose_size, med_food_timing,
              med_photo_box, med_photo_tablet,
              dispensed, dispensed_at, dispensed_by, taken_at
            ) VALUES (
              @date, @person_id, @medication_id, @assignment_id,
              @person_name, @med_proper_name, @med_brand_name, @med_nickname,
              @med_dose, @med_dose_size, @med_food_timing,
              @med_photo_box, @med_photo_tablet,
              @dispensed, @dispensed_at, @dispensed_by, @taken_at
            )`
        )
        .run({
          date,
          person_id: join.person_id,
          medication_id: join.medication_id,
          assignment_id: join.id,
          person_name: join.person_name,
          med_proper_name: join.med_proper_name,
          med_brand_name: join.med_brand_name,
          med_nickname: join.med_nickname,
          med_dose: join.dose_override ?? join.med_dose,
          med_dose_size: join.med_dose_size,
          med_food_timing: join.med_food_timing,
          med_photo_box: join.med_photo_box,
          med_photo_tablet: join.med_photo_tablet,
          dispensed: dispensed ? 1 : 0,
          dispensed_at: dispensed ? now.toISOString() : null,
          dispensed_by: dispensed ? (b.dispensed_by ?? null) : null,
          taken_at: now.toISOString(),
        });
      const row = db
        .prepare<[number], PrnLog>(`SELECT * FROM prn_dose_logs WHERE id = ?`)
        .get(Number(info.lastInsertRowid))!;
      if (row.dispensed === 1) {
        void fireWebhook('dose.dispensed', row.date, prnDosePayload(row));
      }
      void fireWebhook('dose.taken', row.date, prnDosePayload(row));
      reply.code(201);
      return row;
    }
  );

  // Attribution-only patch — does not refire dose.dispensed. Used by the
  // grid's optional parent-name picker after the dose is already logged.
  app.patch<{
    Params: { id: string };
    Body: { dispensed_by?: string | null };
  }>(
    '/api/prn-dose-logs/:id',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            dispensed_by: {
              anyOf: [{ type: 'null' }, { type: 'string', maxLength: 40 }],
            },
          },
        },
      },
    },
    async (req, reply) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare<[number], PrnLog>(`SELECT * FROM prn_dose_logs WHERE id = ?`)
        .get(id);
      if (!existing) return reply.code(404).send({ error: 'not found' });
      const by = req.body.dispensed_by ?? null;
      db.prepare(
        `UPDATE prn_dose_logs SET dispensed_by = ? WHERE id = ?`
      ).run(by, id);
      return { ...existing, dispensed_by: by };
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/prn-dose-logs/:id',
    async (req, reply) => {
      const info = db
        .prepare(`DELETE FROM prn_dose_logs WHERE id = ?`)
        .run(Number(req.params.id));
      if (info.changes === 0)
        return reply.code(404).send({ error: 'not found' });
      reply.code(204).send();
    }
  );
}
