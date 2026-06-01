import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import { NOW, FOOD_TIMINGS } from '../util.js';
import { requirePin } from '../auth.js';

type MedicationRow = {
  id: number;
  proper_name: string;
  brand_name: string | null;
  nickname: string | null;
  dose: string;
  dose_size: string | null;
  photo_box: string | null;
  photo_box_back: string | null;
  photo_tablet: string | null;
  food_timing: (typeof FOOD_TIMINGS)[number];
  notes: string | null;
  active_ingredient: string | null;
  strength: string | null;
  form: string | null;
  quantity_in_pack: string | null;
  expiry_date: string | null;
  instructions_raw: string | null;
  prescribed_to_person_id: number | null;
  created_at: string;
  updated_at: string;
};

const medBody = {
  type: 'object',
  additionalProperties: false,
  properties: {
    proper_name: { type: 'string', minLength: 1, maxLength: 120 },
    brand_name: { type: ['string', 'null'], maxLength: 120 },
    nickname: { type: ['string', 'null'], maxLength: 120 },
    dose: { type: 'string', minLength: 1, maxLength: 80 },
    dose_size: { type: ['string', 'null'], maxLength: 80 },
    photo_box: { type: ['string', 'null'], maxLength: 1024 },
    photo_box_back: { type: ['string', 'null'], maxLength: 1024 },
    photo_tablet: { type: ['string', 'null'], maxLength: 1024 },
    food_timing: { type: 'string', enum: [...FOOD_TIMINGS] },
    notes: { type: ['string', 'null'], maxLength: 2000 },
    active_ingredient: { type: ['string', 'null'], maxLength: 200 },
    strength: { type: ['string', 'null'], maxLength: 80 },
    form: { type: ['string', 'null'], maxLength: 40 },
    quantity_in_pack: { type: ['string', 'null'], maxLength: 80 },
    expiry_date: { type: ['string', 'null'], maxLength: 40 },
    instructions_raw: { type: ['string', 'null'], maxLength: 2000 },
    prescribed_to_person_id: { type: ['integer', 'null'] },
  },
} as const;

const COLS = [
  'proper_name',
  'brand_name',
  'nickname',
  'dose',
  'dose_size',
  'photo_box',
  'photo_box_back',
  'photo_tablet',
  'food_timing',
  'notes',
  'active_ingredient',
  'strength',
  'form',
  'quantity_in_pack',
  'expiry_date',
  'instructions_raw',
  'prescribed_to_person_id',
] as const;

export async function medicationsRoutes(app: FastifyInstance) {
  app.get('/api/medications', async () =>
    db
      .prepare<[], MedicationRow>(`SELECT * FROM medications ORDER BY proper_name, id`)
      .all()
  );

  app.get<{ Params: { id: string } }>(
    '/api/medications/:id',
    async (req, reply) => {
      const row = db
        .prepare<[number], MedicationRow>(`SELECT * FROM medications WHERE id = ?`)
        .get(Number(req.params.id));
      if (!row) return reply.code(404).send({ error: 'not found' });
      return row;
    }
  );

  app.post<{ Body: Partial<MedicationRow> }>(
    '/api/medications',
    { preHandler: requirePin, schema: { body: { ...medBody, required: ['proper_name', 'dose'] } } },
    async (req, reply) => {
      const b = req.body;
      const values: Record<string, unknown> = { updated_at: NOW() };
      for (const c of COLS) {
        if (c === 'proper_name') values[c] = b.proper_name;
        else if (c === 'dose') values[c] = b.dose;
        else if (c === 'food_timing') values[c] = b.food_timing ?? 'none';
        else values[c] = (b as Record<string, unknown>)[c] ?? null;
      }
      const cols = COLS.join(', ');
      const placeholders = COLS.map((c) => `@${c}`).join(', ');
      const info = db
        .prepare(
          `INSERT INTO medications (${cols}, updated_at) VALUES (${placeholders}, @updated_at)`
        )
        .run(values);
      const row = db
        .prepare<[number], MedicationRow>(`SELECT * FROM medications WHERE id = ?`)
        .get(Number(info.lastInsertRowid))!;
      reply.code(201);
      return row;
    }
  );

  app.patch<{ Params: { id: string }; Body: Partial<MedicationRow> }>(
    '/api/medications/:id',
    { preHandler: requirePin, schema: { body: medBody } },
    async (req, reply) => {
      const id = Number(req.params.id);
      const existing = db
        .prepare<[number], MedicationRow>(`SELECT * FROM medications WHERE id = ?`)
        .get(id);
      if (!existing) return reply.code(404).send({ error: 'not found' });
      const b = req.body as Record<string, unknown>;
      const values: Record<string, unknown> = { id, updated_at: NOW() };
      for (const c of COLS) {
        values[c] = c in b ? b[c] : (existing as unknown as Record<string, unknown>)[c];
      }
      const setSql = COLS.map((c) => `${c}=@${c}`).join(', ');
      db.prepare(
        `UPDATE medications SET ${setSql}, updated_at=@updated_at WHERE id=@id`
      ).run(values);
      return db
        .prepare<[number], MedicationRow>(`SELECT * FROM medications WHERE id = ?`)
        .get(id)!;
    }
  );

  app.delete<{ Params: { id: string } }>(
    '/api/medications/:id',
    { preHandler: requirePin },
    async (req, reply) => {
      const info = db
        .prepare(`DELETE FROM medications WHERE id = ?`)
        .run(Number(req.params.id));
      if (info.changes === 0)
        return reply.code(404).send({ error: 'not found' });
      reply.code(204).send();
    }
  );
}
