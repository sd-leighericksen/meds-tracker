export type FoodTiming = 'with_food' | 'before_food' | 'empty_stomach' | 'none';

export type Person = {
  id: number;
  name: string;
  image: string | null;
  requires_dispense: boolean;
  is_child: boolean;
  is_away: boolean;
  away_note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Routine = {
  id: number;
  name: string;
  scheduled_time: string;
  missed_window_minutes: number;
  colour: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Medication = {
  id: number;
  proper_name: string;
  brand_name: string | null;
  nickname: string | null;
  dose: string;
  dose_size: string | null;
  photo_box: string | null;
  photo_box_back: string | null;
  photo_tablet: string | null;
  food_timing: FoodTiming;
  notes: string | null;
  active_ingredient: string | null;
  strength: string | null;
  form: string | null;
  quantity_in_pack: string | null;
  expiry_date: string | null;
  instructions_raw: string | null;
  prescribed_to_person_id: number | null;
  created_at: string;
  updated_at: string;
};

export type AiModel = {
  slug: string;
  label: string;
  blurb: string;
};

export type AiModelsResponse = {
  enabled: boolean;
  default_model: string;
  models: AiModel[];
};

export type ExtractedMed = {
  proper_name: string | null;
  brand_name: string | null;
  active_ingredient: string | null;
  strength: string | null;
  form: string | null;
  dose: string | null;
  dose_size: string | null;
  food_timing: FoodTiming | null;
  quantity_in_pack: string | null;
  expiry_date: string | null;
  instructions_raw: string | null;
  suggested_routine_hint: string | null;
  notes: string | null;
};

export type ExtractResponse = {
  model: string;
  extracted: ExtractedMed;
  suggested_person_id: number | null;
  suggested_routine_id: number | null;
  raw: string;
};

export type ScheduledAssignment = {
  id: number;
  person_id: number;
  routine_id: number;
  medication_id: number;
  dose_override: string | null;
  time_override: string | null;
  missed_window_override: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type PrnAssignment = {
  id: number;
  person_id: number;
  medication_id: number;
  dose_override: string | null;
  max_per_day: number;
  min_interval_hours: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type AwayPeriod = {
  id: number;
  person_id: number;
  start_date: string;
  end_date: string;
  note: string | null;
  created_at: string;
};

export type Settings = {
  parent_names: string[];
  dispensed_by_required: boolean;
  webhook_url: string | null;
  default_ai_model: string;
  ai_enabled: boolean;
  openrouter_api_key_hint: string | null;
};

export type SettingsPatch = Partial<Omit<Settings, 'ai_enabled' | 'openrouter_api_key_hint'>> & {
  openrouter_api_key?: string | null;
};

export type AuthStatus = { pin_set: boolean };
