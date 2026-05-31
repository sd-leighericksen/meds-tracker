import type { FastifyInstance } from 'fastify';
import { fireWebhook } from '../webhooks.js';
import { todayLocalISO } from '../dayService.js';
import { tickOnce } from '../scheduler.js';
import { requirePin } from '../auth.js';
import { getSetting, KEYS } from '../settings.js';

export async function webhookRoutes(app: FastifyInstance) {
  app.post(
    '/api/webhooks/test',
    { preHandler: requirePin },
    async () => {
      const url = getSetting(KEYS.webhookUrl);
      if (!url) return { ok: false, error: 'no webhook_url configured' };
      await fireWebhook('webhook.test', todayLocalISO(), {
        message: 'meds-tracker webhook test',
      });
      return { ok: true, url };
    }
  );

  // Manual scheduler kick — useful during dev / on-wake. PIN-gated since it
  // can side-effect (state transitions and webhook fires).
  app.post('/api/webhooks/tick', { preHandler: requirePin }, async () => {
    await tickOnce();
    return { ok: true };
  });
}
