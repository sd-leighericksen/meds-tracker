import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { getSetting, setSetting, KEYS } from './settings.js';

// In-memory parent-area sessions. Wall tablet, single client, ephemeral.
// Lost on restart and that is fine — the user just re-enters the PIN.
const TOKEN_TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, number>(); // token -> expiry epoch ms

function purgeExpired() {
  const now = Date.now();
  for (const [t, exp] of sessions) if (exp <= now) sessions.delete(t);
}

export function isPinSet(): boolean {
  return getSetting(KEYS.pinHash) !== null;
}

export function setPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits.');
  const hash = bcrypt.hashSync(pin, 10);
  setSetting(KEYS.pinHash, hash);
  // PIN change invalidates everyone.
  sessions.clear();
}

export function verifyPin(pin: string): string | null {
  const hash = getSetting(KEYS.pinHash);
  if (!hash) return null;
  if (!bcrypt.compareSync(pin, hash)) return null;
  const token = randomBytes(24).toString('hex');
  sessions.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function isTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  purgeExpired();
  const exp = sessions.get(token);
  if (!exp || exp <= Date.now()) return false;
  // Sliding session: refresh expiry on use.
  sessions.set(token, Date.now() + TOKEN_TTL_MS);
  return true;
}

export function revokeToken(token: string | undefined) {
  if (token) sessions.delete(token);
}

// Fastify hook: gate write endpoints behind a valid PIN session.
export async function requirePin(req: FastifyRequest, reply: FastifyReply) {
  const token = (req.headers['x-pin-token'] as string | undefined) ?? undefined;
  if (!isTokenValid(token)) {
    reply.code(401).send({ error: 'pin required' });
  }
}

export async function authRoutes(app: FastifyInstance) {
  app.get('/api/auth/status', async () => ({
    pin_set: isPinSet(),
  }));

  app.post<{ Body: { pin?: string } }>(
    '/api/auth/pin/verify',
    {
      schema: {
        body: {
          type: 'object',
          required: ['pin'],
          properties: { pin: { type: 'string', pattern: '^\\d{4}$' } },
        },
      },
    },
    async (req, reply) => {
      const token = verifyPin(req.body.pin!);
      if (!token) return reply.code(401).send({ error: 'bad pin' });
      return { token, ttl_seconds: TOKEN_TTL_MS / 1000 };
    }
  );

  // Initial set when no PIN exists. Requires PIN session otherwise (use change).
  app.post<{ Body: { pin?: string } }>(
    '/api/auth/pin/set',
    {
      schema: {
        body: {
          type: 'object',
          required: ['pin'],
          properties: { pin: { type: 'string', pattern: '^\\d{4}$' } },
        },
      },
    },
    async (req, reply) => {
      if (isPinSet()) {
        // Require an authenticated session to change an existing PIN.
        const token = req.headers['x-pin-token'] as string | undefined;
        if (!isTokenValid(token))
          return reply.code(401).send({ error: 'pin required' });
      }
      setPin(req.body.pin!);
      // Mint a new session so the user stays signed in after change.
      const token = verifyPin(req.body.pin!);
      return { ok: true, token };
    }
  );

  app.post('/api/auth/logout', async (req) => {
    revokeToken(req.headers['x-pin-token'] as string | undefined);
    return { ok: true };
  });
}
