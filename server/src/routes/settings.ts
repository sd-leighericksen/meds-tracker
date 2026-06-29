import type { FastifyInstance } from 'fastify';
import {
  getJSON,
  getOpenrouterKey,
  getSetting,
  setJSON,
  setSetting,
  KEYS,
} from '../settings.js';
import { requirePin } from '../auth.js';
import { DEFAULT_AI_MODEL, isAllowedModel, AI_MODELS } from '../aiModels.js';

type SettingsOut = {
  parent_names: string[];
  dispensed_by_required: boolean;
  webhook_url: string | null;
  default_ai_model: string;
  ai_enabled: boolean;
  openrouter_api_key_hint: string | null;
  incoming_webhook_secret: string | null;
};

// PATCH body has one extra field (openrouter_api_key) that never appears in GET.
type SettingsPatch = Partial<
  Omit<SettingsOut, 'ai_enabled' | 'openrouter_api_key_hint'>
> & {
  openrouter_api_key?: string | null;
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
    default_ai_model: {
      type: 'string',
      enum: AI_MODELS.map((m) => m.slug),
    },
    openrouter_api_key: {
      anyOf: [{ type: 'null' }, { type: 'string', maxLength: 400 }],
    },
    incoming_webhook_secret: {
      anyOf: [{ type: 'null' }, { type: 'string', maxLength: 200 }],
    },
  },
} as const;

function keyHint(): string | null {
  const k = getOpenrouterKey();
  if (!k) return null;
  // Last 4 chars so the UI can render a "…abcd" badge without exposing the key.
  return k.length <= 4 ? '…' : `…${k.slice(-4)}`;
}

function readAll(): SettingsOut {
  return {
    parent_names: getJSON<string[]>(KEYS.parentNames, []),
    dispensed_by_required: getSetting(KEYS.dispensedByRequired) === '1',
    webhook_url: getSetting(KEYS.webhookUrl),
    default_ai_model: getSetting(KEYS.defaultAiModel) ?? DEFAULT_AI_MODEL,
    ai_enabled: getOpenrouterKey() !== null,
    openrouter_api_key_hint: keyHint(),
    incoming_webhook_secret: getSetting(KEYS.incomingWebhookSecret) || null,
  };
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', async () => readAll());

  app.patch<{ Body: SettingsPatch }>(
    '/api/settings',
    { preHandler: requirePin, schema: { body: settingsBody } },
    async (req) => {
      const b = req.body;
      if (b.parent_names !== undefined) setJSON(KEYS.parentNames, b.parent_names);
      if (b.dispensed_by_required !== undefined)
        setSetting(KEYS.dispensedByRequired, b.dispensed_by_required ? '1' : '0');
      if (b.webhook_url !== undefined)
        setSetting(KEYS.webhookUrl, b.webhook_url ?? '');
      if (b.default_ai_model !== undefined && isAllowedModel(b.default_ai_model))
        setSetting(KEYS.defaultAiModel, b.default_ai_model);
      if (b.openrouter_api_key !== undefined)
        setSetting(KEYS.openrouterApiKey, (b.openrouter_api_key ?? '').trim());
      if (b.incoming_webhook_secret !== undefined)
        setSetting(KEYS.incomingWebhookSecret, (b.incoming_webhook_secret ?? '').trim());
      return readAll();
    }
  );
}
