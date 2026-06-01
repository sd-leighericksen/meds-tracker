import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { db } from '../db.js';
import { requirePin } from '../auth.js';
import { getOpenrouterKey, getSetting, KEYS } from '../settings.js';
import { AI_MODELS, DEFAULT_AI_MODEL, isAllowedModel } from '../aiModels.js';
import { getUploadsRoot } from './uploads.js';
import { FOOD_TIMINGS } from '../util.js';

type ExtractedMed = {
  proper_name: string | null;
  brand_name: string | null;
  active_ingredient: string | null;
  strength: string | null;
  form: string | null;
  dose: string | null;
  dose_size: string | null;
  food_timing: (typeof FOOD_TIMINGS)[number] | null;
  quantity_in_pack: string | null;
  expiry_date: string | null;
  instructions_raw: string | null;
  suggested_routine_hint: string | null;
  notes: string | null;
};

// What we coax out of the model. We use prescribed_to_name purely to fuzzy-match
// a person; it's never echoed back to the client.
type ModelExtraction = ExtractedMed & {
  prescribed_to_name?: string | null;
};

type ExtractResponse = {
  model: string;
  extracted: ExtractedMed;
  suggested_person_id: number | null;
  suggested_routine_id: number | null;
  raw: string;
};

const SYSTEM_PROMPT = `You are a careful pharmacy assistant extracting structured data from photos of medication packaging or pharmacy-dispensed labels.

You will be given one or more images of the same medication — these may be different sides of the pack, peeled-back pharmacy labels, the blister/bottle inside the box, or close-ups of small print. Treat them as views of the same item and synthesize the most complete information. If two images conflict, prefer the most legible. Return ONE JSON object with these keys exactly (use null when the information is not visible):

{
  "proper_name": string|null,           // generic / active-ingredient name, e.g. "Paracetamol"
  "brand_name": string|null,            // brand printed on pack, e.g. "Panadol"
  "active_ingredient": string|null,     // explicit active ingredient line if present
  "strength": string|null,              // e.g. "500 mg" or "5 mg/5 ml"
  "form": string|null,                  // "tablet" | "capsule" | "liquid" | "cream" | "drops" | etc.
  "dose": string|null,                  // per-administration dose, e.g. "2 tablets" or "5 ml"
  "dose_size": string|null,             // strength per unit, often same as strength, e.g. "500 mg"
  "food_timing": "with_food"|"before_food"|"empty_stomach"|"none"|null,
  "quantity_in_pack": string|null,      // e.g. "30 tablets"
  "expiry_date": string|null,           // ISO YYYY-MM-DD if visible, else original text
  "prescribed_to_name": string|null,    // patient name on pharmacy label, if any (we use this only to match an existing household member)
  "instructions_raw": string|null,      // verbatim directions printed on the label
  "suggested_routine_hint": string|null,// one of: "morning" | "noon" | "evening" | "night" | "bedtime" | "with breakfast" | "with dinner" | null
  "notes": string|null                  // anything else worth flagging (e.g. "shake well", "do not crush")
}

Rules:
- Output ONLY the JSON object. No markdown, no commentary.
- Never invent data. If unsure, use null.
- For food_timing, only emit "with_food" / "before_food" / "empty_stomach" when the label explicitly says so.
`;

async function fileToDataUrl(url: string): Promise<string> {
  // url is server-local like "/uploads/med-box-xxx.jpg"
  const name = basename(url);
  const path = join(getUploadsRoot(), name);
  const buf = await readFile(path);
  const ext = name.split('.').pop()?.toLowerCase() ?? 'jpeg';
  const mime =
    ext === 'png' ? 'image/png' :
    ext === 'webp' ? 'image/webp' :
    ext === 'gif' ? 'image/gif' : 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function tryParseJson(s: string): ModelExtraction | null {
  // Strip code fences if model wrapped JSON in ```json ... ```
  const trimmed = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  // Find first { ... last }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  try {
    const obj = JSON.parse(trimmed.slice(first, last + 1));
    return obj as ModelExtraction;
  } catch {
    return null;
  }
}

function fuzzyPersonId(name: string | null): number | null {
  if (!name) return null;
  const needle = name.toLowerCase().trim();
  if (!needle) return null;
  const rows = db
    .prepare<[], { id: number; name: string }>(`SELECT id, name FROM people`)
    .all();
  let best: { id: number; score: number } | null = null;
  for (const r of rows) {
    const hay = r.name.toLowerCase();
    let score = 0;
    if (hay === needle) score = 1000;
    else if (needle.includes(hay) || hay.includes(needle)) score = hay.length;
    else {
      // first-name match
      const first = hay.split(/\s+/)[0];
      if (first && needle.split(/\s+/).includes(first)) score = first.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: r.id, score };
  }
  return best?.id ?? null;
}

function routineIdFromHint(hint: string | null): number | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  const rows = db
    .prepare<[], { id: number; name: string; scheduled_time: string }>(
      `SELECT id, name, scheduled_time FROM routines ORDER BY scheduled_time`
    )
    .all();
  if (rows.length === 0) return null;

  const direct = rows.find((r) => r.name.toLowerCase() === h);
  if (direct) return direct.id;
  const contains = rows.find(
    (r) => h.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(h)
  );
  if (contains) return contains.id;

  // Heuristic by time-of-day buckets.
  const isMorning = /morning|breakfast|am/.test(h);
  const isNoon = /noon|midday|lunch/.test(h);
  const isEvening = /evening|dinner|tea/.test(h);
  const isNight = /night|bed/.test(h);

  const minutesOf = (t: string) => {
    const [hh, mm] = t.split(':').map(Number);
    return (hh ?? 0) * 60 + (mm ?? 0);
  };
  const pickClosestTo = (target: number) =>
    rows.reduce((best, r) =>
      Math.abs(minutesOf(r.scheduled_time) - target) <
      Math.abs(minutesOf(best.scheduled_time) - target)
        ? r
        : best
    ).id;

  if (isMorning) return pickClosestTo(8 * 60);
  if (isNoon) return pickClosestTo(12 * 60);
  if (isEvening) return pickClosestTo(18 * 60);
  if (isNight) return pickClosestTo(21 * 60);
  return null;
}

export async function aiExtractRoutes(app: FastifyInstance) {
  app.get('/api/ai/models', async () => ({
    enabled: getOpenrouterKey() !== null,
    default_model: getSetting(KEYS.defaultAiModel) ?? DEFAULT_AI_MODEL,
    models: AI_MODELS,
  }));

  app.post<{
    Body: {
      image_urls: string[];
      model?: string;
    };
  }>(
    '/api/medications/extract',
    {
      preHandler: requirePin,
      schema: {
        body: {
          type: 'object',
          required: ['image_urls'],
          additionalProperties: false,
          properties: {
            image_urls: {
              type: 'array',
              minItems: 1,
              maxItems: 8,
              items: { type: 'string', minLength: 1, maxLength: 1024 },
            },
            model: { type: 'string', maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const apiKey = getOpenrouterKey();
      if (!apiKey) {
        return reply
          .code(503)
          .send({
            error:
              'OpenRouter API key is not configured. Add one in Settings → AI medication extraction.',
          });
      }

      const model = req.body.model ?? getSetting(KEYS.defaultAiModel) ?? DEFAULT_AI_MODEL;
      if (!isAllowedModel(model)) {
        return reply.code(400).send({ error: 'unsupported model', model });
      }

      let imageUrls: string[];
      try {
        imageUrls = await Promise.all(req.body.image_urls.map(fileToDataUrl));
      } catch (e) {
        return reply
          .code(400)
          .send({ error: 'could not read uploaded image', detail: (e as Error).message });
      }

      const userContent: Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      > = [
        {
          type: 'text',
          text: `Extract the medication details from the following ${imageUrls.length} image${imageUrls.length === 1 ? '' : 's'}. All images are of the same medication.`,
        },
        ...imageUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ];

      let openrouterRes: Response;
      try {
        openrouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://meds-tracker.local',
            'X-Title': 'Meds Tracker',
          },
          body: JSON.stringify({
            model,
            temperature: 0,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userContent },
            ],
          }),
        });
      } catch (e) {
        return reply
          .code(502)
          .send({ error: 'openrouter request failed', detail: (e as Error).message });
      }

      if (!openrouterRes.ok) {
        const text = await openrouterRes.text();
        return reply
          .code(502)
          .send({ error: 'openrouter error', status: openrouterRes.status, body: text });
      }

      const json = (await openrouterRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const raw = json.choices?.[0]?.message?.content ?? '';
      const parsed = tryParseJson(raw);
      if (!parsed) {
        return reply
          .code(502)
          .send({ error: 'model returned unparseable output', raw });
      }

      const allowedTimings = new Set(FOOD_TIMINGS);
      const safeTiming =
        parsed.food_timing && allowedTimings.has(parsed.food_timing)
          ? parsed.food_timing
          : null;

      const extracted: ExtractedMed = {
        proper_name: parsed.proper_name ?? null,
        brand_name: parsed.brand_name ?? null,
        active_ingredient: parsed.active_ingredient ?? null,
        strength: parsed.strength ?? null,
        form: parsed.form ?? null,
        dose: parsed.dose ?? null,
        dose_size: parsed.dose_size ?? parsed.strength ?? null,
        food_timing: safeTiming,
        quantity_in_pack: parsed.quantity_in_pack ?? null,
        expiry_date: parsed.expiry_date ?? null,
        instructions_raw: parsed.instructions_raw ?? null,
        suggested_routine_hint: parsed.suggested_routine_hint ?? null,
        notes: parsed.notes ?? null,
      };

      const out: ExtractResponse = {
        model,
        extracted,
        suggested_person_id: fuzzyPersonId(parsed.prescribed_to_name ?? null),
        suggested_routine_id: routineIdFromHint(extracted.suggested_routine_hint),
        raw,
      };
      return out;
    }
  );
}
