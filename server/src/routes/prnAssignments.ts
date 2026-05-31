import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { NOW, DATE_PATTERN } from '../util.js';
import { requirePin } from '../auth.js';

type Row = {
  id: number;
  person_id: number;
  medication_id: number;
  dose_override: string | null;
  max_per_day: number;
  min_interval_hours: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

const body = {
  type: 'object',
  additionalProperties: false,
  properties: {
    person_id: { type: 'integer', minimum: 1 },
    medication_id: { type: 'integer', minimum: 1 },
    dose_override: { type: ['string', 'null'], maxLength: 80 },
    max_per_day: { type: 'integer', minimum: 1, maximum: 100 },
    min_interval_hours: { type: 'number', minimum: 0, maximum: 48 },
    start_date: { anyOf: [{ type: 'null' }, { type: 'string', pattern: DATE_PATTERN }] },
    end_date: { anyOf: [{ type: 'null' }, { type: 'string', pattern: DATE_PATTERN }] },
  },
} as const;

export async function prnAssignmentsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { person_id?: string } }>(
    '/api/prn-assignments',
    async (req) => {
      if (req.query.person_id) {
        return db
          .prepare<[number], Row>(
            `SELECT * FROM prn_assignments WHERE person_id = ? ORDER BY id`
          )
          .all(Number(req.query.person_id));
      }
      return db
        .prepare<[], Row>(`SELECT * FROM prn_assignments ORDER BY person_id, id`)
        .all();
    }
  );

  app.get<{ Params: { id: string } }>(
    '/api/prn-assignments/:id',
    async (req, reply) => {
      const row = db
        .prepare<[number], Row>(`SELECT * FROM prn_assignments WHERE id = ?`)
        .get(Number(req.params.id));
      if (!row) return reply.code(404).send({ error: 'not found' });
      return row;
    }
  );

  app.post<{ Body: Partial<Row> }>(
    '/api/prn-assignments',
    {
      preHandler: requirePin,
      schema: {
        body: {
          ...body,
          required: ['person_id', 'medication_id', 'max_per_day', 'min_interval_hours'],
        },
      },
    },
    async (req, reply) => {
      const b = req.body;
      if (b.start_date && b.end_date && b.start_date > b.end_date) {
        return reply.code(400).send({ error: 'start_date after end_date' });
      }
      try {
        const info = db
          .prepare(
            `INSERT INTO prn_assignments
               (person_id, medication_id, dose_override, max_per_day, min_interval_hours,
                start_date, end_date, updated_at)
             VALUES (@person_id, @medication_id, @dose_override, @max_per_day, @min_interval_hours,
                     @start_date, @end_date, @updated_at)`
          )
          .run({
            person_id: b.person_id,
            medication_id: b.medication_id,
            dose_override: b.dose_override ?? null,
            max_per_day: b.max_per_day,
            min_interval_hours: b.min_interval_hours,
            start_date: b.start_date ?? null,
            end_date: b.end_date ?? null,
            updated_at: NOW(),
          });
        const row = db
          .prepare<[number], Row>(`SELECT * FROM prn_assignments WHERE id = ?`)
          .get(Number(info.lastInsertRowid))!;
        reply.code(201);
        return row;
      } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          return reply.code(400).send({ error: 'unknown person/medication' });
        }
        throw e;
      }
    }
  );

  app.patch<{ Params: { id: string }; Body: Partial<Row> }>(
    '/api/prn-assignments/:id',
    { preHandler: requirePin, schema: { body } },
    async (req, reply) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare<[number], Row>(`SELECT * FROM prn_assignments WHERE id = ?`)
        .get(id);
      if (!existing) return reply.code(404).send({ error: 'not found' });
      const b = req.body;
      const start = b.start_date === undefined ? existing.start_date : b.start_date;
      const end = b.end_date === undefined ? existing.end_date : b.end_date;
      if (start && end && start > end) {
        return reply.code(400).send({ error: 'start_date after end_date' });
      }
      const next = {
        person_id: b.person_id ?? existing.person_id,
        medication_id: b.medication_id ?? existing.medication_id,
        dose_override:
          b.dose_override === undefined ? existing.dose_override : b.dose_override,
        max_per_day: b.max_per_day ?? existing.max_per_day,
        min_interval_hours: b.min_interval_hours ?? existing.min_interval_hours,
        start_date: b.start_date === undefined ? existing.start_date : b.start_date,
        end_date: b.end_date === undefined ? existing.end_date : b.end_date,
        updated_at: NOW(),
        id,
      };
      db.prepare(
        `UPDATE prn_assignments SET
            person_id=@person_id, medication_id=@medication_id,
            dose_override=@dose_override, max_per_day=@max_per_day,
            min_interval_hours=@min_interval_hours,
            start_date=@start_date, end_date=@end_date, updated_at=@updated_at
          WHERE id=@id`
      ).run(next);
      return db
        .prepare<[number], Row>(`SELECT * FROM prn_assignments WHERE id = ?`)
        .get(id)!;
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/prn-assignments/:id',
    { preHandler: requirePin },
    async (req, reply) => {
      const info = db
        .prepare(`DELETE FROM prn_assignments WHERE id = ?`)
        .run(Number(req.params.id));
      if (info.changes === 0)
        return reply.code(404).send({ error: 'not found' });
      reply.code(204).send();
    }
  );
}
