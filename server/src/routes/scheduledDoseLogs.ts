import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';
import type { DayLog } from '../dayService.js';
import { computeTakenOutcome } from '../lifecycle.js';
import {
  fireWebhook,
  maybeFireRoutineComplete,
  scheduledDosePayload,
} from '../webhooks.js';

const get = db.prepare<[number], DayLog>(
  `SELECT * FROM scheduled_dose_logs WHERE id = ?`
);

function update(id: number, patch: Partial<DayLog>): DayLog | null {
  const existing = get.get(id);
  if (!existing) return null;
  if (existing.outcome === 'away') return existing; // away rows are not interactive
  const next = { ...existing, ...patch };

  // Derive outcome from the new state. Brief §5: late doses get logged late;
  // un-tapping a dose clears outcome back to pending.
  let outcome: DayLog['outcome'] = next.outcome;
  if (next.taken === 1 && next.taken_at) {
    outcome = computeTakenOutcome(
      next.date,
      next.due_time,
      next.missed_window_minutes,
      next.taken_at
    );
  } else if (next.taken === 0) {
    outcome = null;
  }

  db.prepare(
    `UPDATE scheduled_dose_logs SET
        dispensed=@dispensed, dispensed_at=@dispensed_at, dispensed_by=@dispensed_by,
        taken=@taken, taken_at=@taken_at, outcome=@outcome,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
      WHERE id=@id`
  ).run({
    id,
    dispensed: next.dispensed,
    dispensed_at: next.dispensed_at,
    dispensed_by: next.dispensed_by,
    taken: next.taken,
    taken_at: next.taken_at,
    outcome,
  });
  return get.get(id) ?? null;
}

const dispenseBody = {
  type: 'object',
  additionalProperties: false,
  properties: {
    by: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 40 }] },
  },
} as const;

export async function scheduledDoseLogsRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: { by?: string | null } }>(
    '/api/scheduled-dose-logs/:id/dispense',
    { schema: { body: dispenseBody } },
    async (req, reply) => {
      const id = Number(req.params.id);
      const before = get.get(id);
      const wasDispensed = before?.dispensed === 1;
      const row = update(id, {
        dispensed: 1,
        // Preserve the original dispensed_at when re-tapping to add attribution.
        dispensed_at: wasDispensed
          ? (before?.dispensed_at ?? new Date().toISOString())
          : new Date().toISOString(),
        dispensed_by: req.body?.by ?? before?.dispensed_by ?? null,
      });
      if (!row) return reply.code(404).send({ error: 'not found' });
      // Only fire the webhook on the dispensed=0 → 1 transition. Subsequent
      // attribution updates do not refire.
      if (!wasDispensed && row.outcome !== 'away') {
        void fireWebhook('dose.dispensed', row.date, scheduledDosePayload(row));
      }
      return row;
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/scheduled-dose-logs/:id/undispense',
    async (req, reply) => {
      const id = Number(req.params.id);
      const row = update(id, { dispensed: 0, dispensed_at: null, dispensed_by: null });
      if (!row) return reply.code(404).send({ error: 'not found' });
      return row;
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/scheduled-dose-logs/:id/take',
    async (req, reply) => {
      const id = Number(req.params.id);
      const row = update(id, { taken: 1, taken_at: new Date().toISOString() });
      if (!row) return reply.code(404).send({ error: 'not found' });
      if (row.outcome !== 'away') {
        void fireWebhook('dose.taken', row.date, scheduledDosePayload(row));
        void maybeFireRoutineComplete(row.date, row.person_id, row.routine_id);
      }
      return row;
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/scheduled-dose-logs/:id/untake',
    async (req, reply) => {
      const id = Number(req.params.id);
      const row = update(id, { taken: 0, taken_at: null });
      if (!row) return reply.code(404).send({ error: 'not found' });
      return row;
    }
  );
}
