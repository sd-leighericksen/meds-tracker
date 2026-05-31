import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { NOW, TIME_HHMM_PATTERN, DATE_PATTERN } from '../util.js';
import { requirePin } from '../auth.js';

type Row = {
  id: number;
  person_id: number;
  routine_id: number;
  medication_id: number;
  dose_override: string | null;
  time_override: string | null;
  missed_window_override: number | null;
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
    routine_id: { type: 'integer', minimum: 1 },
    medication_id: { type: 'integer', minimum: 1 },
    dose_override: { type: ['string', 'null'], maxLength: 80 },
    time_override: {
      anyOf: [{ type: 'null' }, { type: 'string', pattern: TIME_HHMM_PATTERN }],
    },
    missed_window_override: {
      anyOf: [{ type: 'null' }, { type: 'integer', minimum: 0, maximum: 24 * 60 }],
    },
    start_date: { anyOf: [{ type: 'null' }, { type: 'string', pattern: DATE_PATTERN }] },
    end_date: { anyOf: [{ type: 'null' }, { type: 'string', pattern: DATE_PATTERN }] },
  },
} as const;

export async function scheduledAssignmentsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { routine_id?: string; person_id?: string } }>(
    '/api/scheduled-assignments',
    async (req) => {
      const r = req.query.routine_id ? Number(req.query.routine_id) : null;
      const p = req.query.person_id ? Number(req.query.person_id) : null;
      const where: string[] = [];
      const args: number[] = [];
      if (r) { where.push('routine_id = ?'); args.push(r); }
      if (p) { where.push('person_id = ?'); args.push(p); }
      const sql =
        `SELECT * FROM scheduled_assignments` +
        (where.length ? ` WHERE ${where.join(' AND ')}` : ``) +
        ` ORDER BY routine_id, person_id, id`;
      return db.prepare<number[], Row>(sql).all(...args);
    }
  );

  app.get<{ Params: { id: string } }>(
    '/api/scheduled-assignments/:id',
    async (req, reply) => {
      const row = db
        .prepare<[number], Row>(`SELECT * FROM scheduled_assignments WHERE id = ?`)
        .get(Number(req.params.id));
      if (!row) return reply.code(404).send({ error: 'not found' });
      return row;
    }
  );

  app.post<{ Body: Partial<Row> }>(
    '/api/scheduled-assignments',
    {
      preHandler: requirePin,
      schema: { body: { ...body, required: ['person_id', 'routine_id', 'medication_id'] } },
    },
    async (req, reply) => {
      const b = req.body;
      if (b.start_date && b.end_date && b.start_date > b.end_date) {
        return reply.code(400).send({ error: 'start_date after end_date' });
      }
      try {
        const info = db
          .prepare(
            `INSERT INTO scheduled_assignments
               (person_id, routine_id, medication_id, dose_override, time_override,
                missed_window_override, start_date, end_date, updated_at)
             VALUES (@person_id, @routine_id, @medication_id, @dose_override, @time_override,
                     @missed_window_override, @start_date, @end_date, @updated_at)`
          )
          .run({
            person_id: b.person_id,
            routine_id: b.routine_id,
            medication_id: b.medication_id,
            dose_override: b.dose_override ?? null,
            time_override: b.time_override ?? null,
            missed_window_override: b.missed_window_override ?? null,
            start_date: b.start_date ?? null,
            end_date: b.end_date ?? null,
            updated_at: NOW(),
          });
        const row = db
          .prepare<[number], Row>(`SELECT * FROM scheduled_assignments WHERE id = ?`)
          .get(Number(info.lastInsertRowid))!;
        reply.code(201);
        return row;
      } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          return reply.code(400).send({ error: 'unknown person/routine/medication' });
        }
        throw e;
      }
    }
  );

  app.patch<{ Params: { id: string }; Body: Partial<Row> }>(
    '/api/scheduled-assignments/:id',
    { preHandler: requirePin, schema: { body } },
    async (req, reply) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare<[number], Row>(`SELECT * FROM scheduled_assignments WHERE id = ?`)
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
        routine_id: b.routine_id ?? existing.routine_id,
        medication_id: b.medication_id ?? existing.medication_id,
        dose_override:
          b.dose_override === undefined ? existing.dose_override : b.dose_override,
        time_override:
          b.time_override === undefined ? existing.time_override : b.time_override,
        missed_window_override:
          b.missed_window_override === undefined
            ? existing.missed_window_override
            : b.missed_window_override,
        start_date: b.start_date === undefined ? existing.start_date : b.start_date,
        end_date: b.end_date === undefined ? existing.end_date : b.end_date,
        updated_at: NOW(),
        id,
      };
      db.prepare(
        `UPDATE scheduled_assignments SET
            person_id=@person_id, routine_id=@routine_id, medication_id=@medication_id,
            dose_override=@dose_override, time_override=@time_override,
            missed_window_override=@missed_window_override,
            start_date=@start_date, end_date=@end_date, updated_at=@updated_at
          WHERE id=@id`
      ).run(next);
      return db
        .prepare<[number], Row>(`SELECT * FROM scheduled_assignments WHERE id = ?`)
        .get(id)!;
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/scheduled-assignments/:id',
    { preHandler: requirePin },
    async (req, reply) => {
      const info = db
        .prepare(`DELETE FROM scheduled_assignments WHERE id = ?`)
        .run(Number(req.params.id));
      if (info.changes === 0)
        return reply.code(404).send({ error: 'not found' });
      reply.code(204).send();
    }
  );
}
