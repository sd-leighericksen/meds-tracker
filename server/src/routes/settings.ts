import type { FastifyInstance } from 'fastify';
import { getJSON, getSetting, setJSON, setSetting, KEYS } from '../settings.js';
import { requirePin } from '../auth.js';

type SettingsOut = {
  parent_names: string[];
  dispensed_by_required: boolean;
  webhook_url: string | null;
};

const settingsBody = {
  type: 'object',
  additionalProperties: false,
  properties: {
    parent_names: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 40 },
      maxItems: 20,
    },
    dispensed_by_required: { type: 'boolean' },
    webhook_url: { anyOf: [{ type: 'null' }, { type: 'string', maxLength: 1024 }] },
  },
} as const;

function readAll(): SettingsOut {
  return {
    parent_names: getJSON<string[]>(KEYS.parentNames, []),
    dispensed_by_required: getSetting(KEYS.dispensedByRequired) === '1',
    webhook_url: getSetting(KEYS.webhookUrl),
  };
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async () => readAll());

  app.patch<{ Body: Partial<SettingsOut> }>(
    '/api/settings',
    { preHandler: requirePin, schema: { body: settingsBody } },
    async (req) => {
      const b = req.body;
      if (b.parent_names !== undefined) setJSON(KEYS.parentNames, b.parent_names);
      if (b.dispensed_by_required !== undefined)
        setSetting(KEYS.dispensedByRequired, b.dispensed_by_required ? '1' : '0');
      if (b.webhook_url !== undefined)
        setSetting(KEYS.webhookUrl, b.webhook_url ?? '');
      return readAll();
    }
  );
}
