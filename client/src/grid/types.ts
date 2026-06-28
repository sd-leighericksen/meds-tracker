import type { FoodTiming, Routine } from '../types';

export type DayLog = {
  id: number;
  date: string;
  person_id: number;
  routine_id: number;
  medication_id: number;
  assignment_id: number;
  person_name: string;
  routine_name: string;
  med_proper_name: string;
  med_brand_name: string | null;
  med_nickname: string | null;
  med_dose: string;
  med_dose_size: string | null;
  med_food_timing: FoodTiming;
  med_photo_box: string | null;
  med_photo_tablet: string | null;
  due_time: string;
  missed_window_minutes: number;
  dispensed: 0 | 1;
  dispensed_at: string | null;
  dispensed_by: string | null;
  taken: 0 | 1;
  taken_at: string | null;
  outcome: 'taken_on_time' | 'taken_late' | 'missed' | 'away' | null;
};

export type DayPerson = {
  id: number;
  name: string;
  image: string | null;
  requires_dispense: boolean;
  is_child: boolean;
  sort_order: number;
  away: boolean;
  away_note: string | null;
};

export type DayColumn = {
  medication_id: number;
  med_proper_name: string;
  med_brand_name: string | null;
  med_nickname: string | null;
  med_dose: string;
  med_dose_size: string | null;
  med_food_timing: FoodTiming;
  med_photo_box: string | null;
  med_photo_tablet: string | null;
  due_time: string;
};

export type DayPayload = {
  date: string;
  now: string;
  active_routine_id: number | null;
  people: DayPerson[];
  routines: Routine[];
  columns_by_routine: Record<number, DayColumn[]>;
  grid: Record<number, Record<number, Record<number, DayLog>>>;
};

export type PrnLog = {
  id: number;
  date: string;
  person_id: number;
  medication_id: number;
  assignment_id: number;
  person_name: string;
  med_proper_name: string;
  med_dose: string;
  dispensed: 0 | 1;
  dispensed_at: string | null;
  dispensed_by: string | null;
  taken_at: string;
  created_at: string;
};

export type PrnItem = {
  assignment_id: number;
  person_id: number;
  person_name: string;
  person_requires_dispense: boolean;
  medication_id: number;
  med: {
    proper_name: string;
    brand_name: string | null;
    nickname: string | null;
    dose: string;
    dose_size: string | null;
    food_timing: FoodTiming;
    photo_box: string | null;
    photo_tablet: string | null;
  };
  max_per_day: number;
  min_interval_hours: number;
  taken_today: number;
  last_taken_at: string | null;
  today_logs: PrnLog[];
};

export type PrnToday = { date: string; items: PrnItem[] };
