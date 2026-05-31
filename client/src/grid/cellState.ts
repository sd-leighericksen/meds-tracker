import type { DayLog } from './types';

export type CellState =
  | 'pending'
  | 'due'
  | 'overdue'
  | 'taken_on_time'
  | 'taken_late'
  | 'missed'
  | 'away';

export function deriveCellState(log: DayLog, now: Date): CellState {
  if (log.outcome === 'away') return 'away';
  if (log.outcome === 'missed') return 'missed';
  if (log.outcome === 'taken_on_time') return 'taken_on_time';
  if (log.outcome === 'taken_late') return 'taken_late';
  // Fallback if the server hasn't stamped an outcome yet for a taken row.
  if (log.taken === 1) return 'taken_on_time';

  const due = new Date(`${log.date}T${log.due_time}:00`);
  const missedAt = new Date(due.getTime() + log.missed_window_minutes * 60_000);
  if (now.getTime() >= missedAt.getTime()) return 'overdue';
  if (now.getTime() >= due.getTime()) return 'due';
  return 'pending';
}

export type StateLook = {
  /** Outer cell classes. */
  container: string;
  /** Optional pill rendered above the checkboxes. */
  badge?: { label: string; cls: string };
};

export const STATE_LOOK: Record<CellState, StateLook> = {
  pending: {
    container: 'border-hairline-soft bg-canvas',
  },
  due: {
    container: 'border-brand-yellow bg-yellow-light',
    badge: { label: 'Due now', cls: 'bg-brand-yellow text-primary' },
  },
  overdue: {
    container: 'border-brand-red-dark/40 bg-brand-red/60',
    badge: { label: 'Overdue', cls: 'bg-brand-red-dark text-on-primary' },
  },
  taken_on_time: {
    container: 'border-teal-light bg-teal-light',
  },
  taken_late: {
    container: 'border-teal-light bg-teal-light',
    badge: { label: 'Late', cls: 'bg-coral-light text-coral-dark' },
  },
  missed: {
    container: 'border-brand-red-dark/40 bg-brand-red/30',
    badge: { label: 'Missed', cls: 'bg-brand-red-dark text-on-primary' },
  },
  away: {
    container: 'border-hairline-soft bg-surface',
  },
};
