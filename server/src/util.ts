export const NOW = () => new Date().toISOString();

// HH:MM (24h) validator regex string for JSON Schema.
export const TIME_HHMM_PATTERN = '^([01][0-9]|2[0-3]):[0-5][0-9]$';
// YYYY-MM-DD validator regex string for JSON Schema.
export const DATE_PATTERN = '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$';

export const FOOD_TIMINGS = ['with_food', 'before_food', 'empty_stomach', 'none'] as const;

export function boolToInt(v: unknown): 0 | 1 {
  return v ? 1 : 0;
}
