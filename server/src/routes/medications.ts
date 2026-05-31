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
  photo_tablet: string | null;
  food_timing: (typeof FOOD_TIMINGS)[number];
  notes: string | null;
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
    photo_tablet: { type: ['string', 'null'], maxLength: 1024 },
    food_timing: { type: 'string', enum: [...FOOD_TIMINGS] },
    notes: { type: ['string', 'null'], maxLength: 2000 },
  },
} as const;

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
      const info = db
        .prepare(
          `INSERT INTO medications
             (proper_name, brand_name, nickname, dose, dose_size,
              photo_box, photo_tablet, food_timing, notes, updated_at)
           VALUES
             (@proper_name, @brand_name, @nickname, @dose, @dose_size,
              @photo_box, @photo_tablet, @food_timing, @notes, @updated_at)`
        )
        .run({
          proper_name: b.proper_name,
          brand_name: b.brand_name ?? null,
          nickname: b.nickname ?? null,
          dose: b.dose,
          dose_size: b.dose_size ?? null,
          photo_box: b.photo_box ?? null,
          photo_tablet: b.photo_tablet ?? null,
          food_timing: b.food_timing ?? 'none',
          notes: b.notes ?? null,
          updated_at: NOW(),
        });
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
      const b = req.body;
      db.prepare(
        `UPDATE medications SET
            proper_name=@proper_name, brand_name=@brand_name, nickname=@nickname,
            dose=@dose, dose_size=@dose_size,
            photo_box=@photo_box, photo_tablet=@photo_tablet,
            food_timing=@food_timing, notes=@notes, updated_at=@updated_at
          WHERE id=@id`
      ).run({
        proper_name: b.proper_name ?? existing.proper_name,
        brand_name: b.brand_name === undefined ? existing.brand_name : b.brand_name,
        nickname: b.nickname === undefined ? existing.nickname : b.nickname,
        dose: b.dose ?? existing.dose,
        dose_size: b.dose_size === undefined ? existing.dose_size : b.dose_size,
        photo_box: b.photo_box === undefined ? existing.photo_box : b.photo_box,
        photo_tablet:
          b.photo_tablet === undefined ? existing.photo_tablet : b.photo_tablet,
        food_timing: b.food_timing ?? existing.food_timing,
        notes: b.notes === undefined ? existing.notes : b.notes,
        updated_at: NOW(),
        id,
      });
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
