import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { NOW, TIME_HHMM_PATTERN } from '../util.js';
import { requirePin } from '../auth.js';

type RoutineRow = {
  id: number;
  name: string;
  scheduled_time: string;
  missed_window_minutes: number;
  colour: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const routineBody = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    scheduled_time: { type: 'string', pattern: TIME_HHMM_PATTERN },
    missed_window_minutes: { type: 'integer', minimum: 0, maximum: 24 * 60 },
    colour: { type: ['string', 'null'], maxLength: 64 },
    sort_order: { type: 'integer', minimum: 0 },
  },
} as const;

export async function routinesRoutes(app: FastifyInstance) {
  app.get('/api/routines', async () =>
    db
      .prepare<[], RoutineRow>(
        `SELECT * FROM routines ORDER BY scheduled_time, sort_order, id`
      )
      .all()
  );

  app.get<{ Params: { id: string } }>('/api/routines/:id', async (req, reply) => {
    const row = db
      .prepare<[number], RoutineRow>(`SELECT * FROM routines WHERE id = ?`)
      .get(Number(req.params.id));
    if (!row) return reply.code(404).send({ error: 'not found' });
    return row;
  });

  app.post<{ Body: Partial<RoutineRow> }>(
    '/api/routines',
    { preHandler: requirePin, schema: { body: { ...routineBody, required: ['name', 'scheduled_time'] } } },
    async (req, reply) => {
      const b = req.body;
      const info = db
        .prepare(
          `INSERT INTO routines (name, scheduled_time, missed_window_minutes, colour, sort_order, updated_at)
           VALUES (@name, @scheduled_time, @missed_window_minutes, @colour, @sort_order, @updated_at)`
        )
        .run({
          name: b.name,
          scheduled_time: b.scheduled_time,
          missed_window_minutes: b.missed_window_minutes ?? 60,
          colour: b.colour ?? null,
          sort_order: b.sort_order ?? 0,
          updated_at: NOW(),
        });
      const row = db
        .prepare<[number], RoutineRow>(`SELECT * FROM routines WHERE id = ?`)
        .get(Number(info.lastInsertRowid))!;
      reply.code(201);
      return row;
    }
  );

  app.patch<{ Params: { id: string }; Body: Partial<RoutineRow> }>(
    '/api/routines/:id',
    { preHandler: requirePin, schema: { body: routineBody } },
    async (req, reply) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare<[number], RoutineRow>(`SELECT * FROM routines WHERE id = ?`)
        .get(id);
      if (!existing) return reply.code(404).send({ error: 'not found' });
      const b = req.body;
      db.prepare(
        `UPDATE routines SET name=@name, scheduled_time=@scheduled_time,
                missed_window_minutes=@missed_window_minutes, colour=@colour,
                sort_order=@sort_order, updated_at=@updated_at
         WHERE id=@id`
      ).run({
        name: b.name ?? existing.name,
        scheduled_time: b.scheduled_time ?? existing.scheduled_time,
        missed_window_minutes:
          b.missed_window_minutes ?? existing.missed_window_minutes,
        colour: b.colour === undefined ? existing.colour : b.colour,
        sort_order: b.sort_order ?? existing.sort_order,
        updated_at: NOW(),
        id,
      });
      return db
        .prepare<[number], RoutineRow>(`SELECT * FROM routines WHERE id = ?`)
        .get(id)!;
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/routines/:id',
    { preHandler: requirePin },
    async (req, reply) => {
      const info = db
        .prepare(`DELETE FROM routines WHERE id = ?`)
        .run(Number(req.params.id));
      if (info.changes === 0)
        return reply.code(404).send({ error: 'not found' });
      reply.code(204).send();
    }
  );
}
