import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { DATE_PATTERN } from '../util.js';
import { requirePin } from '../auth.js';

type Row = {
  id: number;
  person_id: number;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
};

const body = {
  type: 'object',
  additionalProperties: false,
  properties: {
    person_id: { type: 'integer', minimum: 1 },
    start_date: { type: 'string', pattern: DATE_PATTERN },
    end_date: { type: 'string', pattern: DATE_PATTERN },
    note: { type: ['string', 'null'], maxLength: 200 },
  },
} as const;

export async function awayPeriodsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { person_id?: string } }>(
    '/api/away-periods',
    async (req) => {
      if (req.query.person_id) {
        return db
          .prepare<[number], Row>(
            `SELECT * FROM away_periods WHERE person_id = ? ORDER BY start_date DESC, id DESC`
          )
          .all(Number(req.query.person_id));
      }
      return db
        .prepare<[], Row>(`SELECT * FROM away_periods ORDER BY start_date DESC, id DESC`)
        .all();
    }
  );

  app.post<{ Body: Partial<Row> }>(
    '/api/away-periods',
    {
      preHandler: requirePin,
      schema: {
        body: { ...body, required: ['person_id', 'start_date', 'end_date'] },
      },
    },
    async (req, reply) => {
      const b = req.body;
      if (b.start_date! > b.end_date!) {
        return reply.code(400).send({ error: 'start_date after end_date' });
      }
      try {
        const info = db
          .prepare(
            `INSERT INTO away_periods (person_id, start_date, end_date, note)
             VALUES (@person_id, @start_date, @end_date, @note)`
          )
          .run({
            person_id: b.person_id,
            start_date: b.start_date,
            end_date: b.end_date,
            note: b.note ?? null,
          });
        const row = db
          .prepare<[number], Row>(`SELECT * FROM away_periods WHERE id = ?`)
          .get(Number(info.lastInsertRowid))!;
        reply.code(201);
        return row;
      } catch (e) {
        if ((e as { code?: string }).code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          return reply.code(400).send({ error: 'unknown person' });
        }
        throw e;
      }
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/away-periods/:id',
    { preHandler: requirePin },
    async (req, reply) => {
      const info = db
        .prepare(`DELETE FROM away_periods WHERE id = ?`)
        .run(Number(req.params.id));
      if (info.changes === 0)
        return reply.code(404).send({ error: 'not found' });
      reply.code(204).send();
    }
  );
}
