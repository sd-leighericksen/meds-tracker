import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { db } from '../db.js';
import { NOW, boolToInt } from '../util.js';
import { getSetting, KEYS } from '../settings.js';

type PersonRow = {
  id: number;
  name: string;
  is_away: 0 | 1;
  away_note: string | null;
};

/** Constant-time string compare that tolerates length differences. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Pull the caller-supplied secret from header, query, or body. */
function readSecret(req: FastifyRequest): string {
  const header = req.headers['x-webhook-secret'];
  if (typeof header === 'string' && header) return header;
  const q = (req.query as { secret?: string } | undefined)?.secret;
  if (typeof q === 'string' && q) return q;
  const b = (req.body as { secret?: string } | undefined)?.secret;
  if (typeof b === 'string' && b) return b;
  return '';
}

function authorize(req: FastifyRequest, reply: FastifyReply): boolean {
  const expected = getSetting(KEYS.incomingWebhookSecret) || '';
  if (!expected) {
    reply.code(503).send({ error: 'incoming webhooks disabled — no secret set' });
    return false;
  }
  if (!secretMatches(readSecret(req), expected)) {
    reply.code(401).send({ error: 'bad or missing secret' });
    return false;
  }
  return true;
}

const awayBody = {
  type: 'object',
  additionalProperties: false,
  properties: {
    secret: { type: 'string' },
    person_id: { type: 'integer', minimum: 1 },
    person: { type: 'string', minLength: 1, maxLength: 80 },
    away: { type: 'boolean' },
    note: { type: ['string', 'null'], maxLength: 200 },
  },
} as const;

export async function incomingRoutes(app: FastifyInstance) {
  // External automations (e.g. n8n) can flip a person to away / home.
  // Auth is a shared secret, NOT the parent PIN, so it works headlessly.
  app.post<{
    Querystring: { secret?: string };
    Body: {
      secret?: string;
      person_id?: number;
      person?: string;
      away?: boolean;
      note?: string | null;
    };
  }>(
    '/api/incoming/away',
    { schema: { body: awayBody } },
    async (req, reply) => {
      if (!authorize(req, reply)) return reply;

      const b = req.body ?? {};
      let person: PersonRow | undefined;
      if (typeof b.person_id === 'number') {
        person = db
          .prepare<[number], PersonRow>(
            `SELECT id, name, is_away, away_note FROM people WHERE id = ?`
          )
          .get(b.person_id);
      } else if (typeof b.person === 'string' && b.person.trim()) {
        person = db
          .prepare<[string], PersonRow>(
            `SELECT id, name, is_away, away_note FROM people
              WHERE lower(name) = lower(?) ORDER BY id LIMIT 1`
          )
          .get(b.person.trim());
      } else {
        return reply.code(400).send({ error: 'person_id or person (name) required' });
      }

      if (!person) return reply.code(404).send({ error: 'unknown person' });

      const away = b.away ?? true;
      const note = away ? (b.note?.trim() || null) : null;
      db.prepare(
        `UPDATE people SET is_away = @is_away, away_note = @away_note, updated_at = @updated_at
          WHERE id = @id`
      ).run({
        is_away: boolToInt(away),
        away_note: note,
        updated_at: NOW(),
        id: person.id,
      });

      return {
        ok: true,
        person: { id: person.id, name: person.name, is_away: away, away_note: note },
      };
    }
  );
}
