import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { NOW, boolToInt } from '../util.js';
import { requirePin } from '../auth.js';

type PersonRow = {
  id: number;
  name: string;
  image: string | null;
  requires_dispense: 0 | 1;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type PersonOut = Omit<PersonRow, 'requires_dispense'> & { requires_dispense: boolean };

const toOut = (r: PersonRow): PersonOut => ({
  ...r,
  requires_dispense: r.requires_dispense === 1,
});

const personBody = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    image: { type: ['string', 'null'], maxLength: 1024 },
    requires_dispense: { type: 'boolean' },
    sort_order: { type: 'integer', minimum: 0 },
  },
} as const;

export async function peopleRoutes(app: FastifyInstance) {
  app.get('/api/people', async () => {
    const rows = db
      .prepare<[], PersonRow>(`SELECT * FROM people ORDER BY sort_order, id`)
      .all();
    return rows.map(toOut);
  });

  app.get<{ Params: { id: string } }>('/api/people/:id', async (req, reply) => {
    const row = db
      .prepare<[number], PersonRow>(`SELECT * FROM people WHERE id = ?`)
      .get(Number(req.params.id));
    if (!row) return reply.code(404).send({ error: 'not found' });
    return toOut(row);
  });

  app.post<{ Body: Partial<PersonOut> }>(
    '/api/people',
    {
      preHandler: requirePin,
      schema: {
        body: { ...personBody, required: ['name'] },
      },
    },
    async (req, reply) => {
      const b = req.body;
      const stmt = db.prepare(
        `INSERT INTO people (name, image, requires_dispense, sort_order, updated_at)
         VALUES (@name, @image, @requires_dispense, @sort_order, @updated_at)`
      );
      const info = stmt.run({
        name: b.name,
        image: b.image ?? null,
        requires_dispense: boolToInt(b.requires_dispense),
        sort_order: b.sort_order ?? 0,
        updated_at: NOW(),
      });
      const row = db
        .prepare<[number], PersonRow>(`SELECT * FROM people WHERE id = ?`)
        .get(Number(info.lastInsertRowid))!;
      reply.code(201);
      return toOut(row);
    }
  );

  app.patch<{ Params: { id: string }; Body: Partial<PersonOut> }>(
    '/api/people/:id',
    { preHandler: requirePin, schema: { body: personBody } },
    async (req, reply) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare<[number], PersonRow>(`SELECT * FROM people WHERE id = ?`)
        .get(id);
      if (!existing) return reply.code(404).send({ error: 'not found' });

      const b = req.body;
      const next = {
        name: b.name ?? existing.name,
        image: b.image === undefined ? existing.image : b.image,
        requires_dispense:
          b.requires_dispense === undefined
            ? existing.requires_dispense
            : boolToInt(b.requires_dispense),
        sort_order: b.sort_order ?? existing.sort_order,
        updated_at: NOW(),
        id,
      };
      db.prepare(
        `UPDATE people SET name=@name, image=@image, requires_dispense=@requires_dispense,
                          sort_order=@sort_order, updated_at=@updated_at
         WHERE id=@id`
      ).run(next);
      const row = db
        .prepare<[number], PersonRow>(`SELECT * FROM people WHERE id = ?`)
        .get(id)!;
      return toOut(row);
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/people/:id',
    { preHandler: requirePin },
    async (req, reply) => {
      const info = db
        .prepare(`DELETE FROM people WHERE id = ?`)
        .run(Number(req.params.id));
      if (info.changes === 0)
        return reply.code(404).send({ error: 'not found' });
      reply.code(204).send();
    }
  );
}
