// OpenRouter models the user can pick for medication-photo extraction.
// All are vision-capable. Keep this list short and curated.
export type AiModel = {
  slug: string;
  label: string;
  blurb: string;
};

export const AI_MODELS: AiModel[] = [
  {
    slug: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    blurb: 'Fast & cheap. Good default for clear packaging.',
  },
  {
    slug: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    blurb: 'Accuracy tier when Flash misreads small print.',
  },
  {
    slug: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    blurb: 'Best at interpreting dosing instructions.',
  },
  {
    slug: 'openai/gpt-5-mini',
    label: 'GPT-5 mini',
    blurb: 'Balanced fallback.',
  },
  {
    slug: 'qwen/qwen3-vl-235b-a22b-instruct',
    label: 'Qwen3-VL 235B',
    blurb: 'Cheapest competent option.',
  },
];

export const DEFAULT_AI_MODEL = AI_MODELS[0].slug;

export function isAllowedModel(slug: string): boolean {
  return AI_MODELS.some((m) => m.slug === slug);
}
