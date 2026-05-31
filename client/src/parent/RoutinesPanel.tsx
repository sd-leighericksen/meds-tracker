import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Routine } from '../types';
import { btn, EmptyHint, ErrorBanner, Field, Input, Modal } from '../ui';

export function RoutinesPanel() {
  const [rows, setRows] = useState<Routine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);

  const reload = () =>
    api.listRoutines().then(setRows).catch((e: Error) => setError(e.message));

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-ink">Routines</h2>
        <button className={btn.primary} onClick={() => setEditing('new')}>
          + Add routine
        </button>
      </div>
      <ErrorBanner error={error} />
      {rows.length === 0 ? (
        <EmptyHint>
          No routines yet. Routines are the recurring time-of-day moments doses are due
          (e.g. Morning, Lunch, Bedtime).
        </EmptyHint>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <RoutineRow key={r.id} routine={r} onEdit={() => setEditing(r)} onChanged={reload} />
          ))}
        </div>
      )}
      {editing && (
        <RoutineEdit
          routine={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function RoutineRow({
  routine,
  onEdit,
  onChanged,
}: {
  routine: Routine;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const remove = async () => {
    if (!confirm(`Remove "${routine.name}"? Its assignments will also be removed. Past logs are kept.`))
      return;
    try {
      await api.deleteRoutine(routine.id);
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <div className="flex h-14 w-20 items-center justify-center rounded-2xl bg-surface text-h4 text-ink">
        {routine.scheduled_time}
      </div>
      <div className="flex flex-1 flex-col">
        <span className="text-h5 text-ink">{routine.name}</span>
        <span className="text-caption text-slate">
          Missed after {routine.missed_window_minutes} min
        </span>
      </div>
      <button className={btn.secondary} onClick={onEdit}>
        Edit
      </button>
      <button className={btn.ghost} onClick={remove}>
        Remove
      </button>
    </div>
  );
}

function RoutineEdit({
  routine,
  onClose,
  onSaved,
}: {
  routine: Routine | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(routine?.name ?? '');
  const [time, setTime] = useState(routine?.scheduled_time ?? '08:00');
  const [missed, setMissed] = useState(routine?.missed_window_minutes ?? 60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        scheduled_time: time,
        missed_window_minutes: missed,
      };
      if (routine) await api.updateRoutine(routine.id, payload);
      else await api.createRoutine(payload);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={routine ? `Edit ${routine.name}` : 'Add routine'}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={btn.primary}
            onClick={save}
            disabled={busy || !name.trim()}
          >
            Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ErrorBanner error={error} />
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Scheduled time (24h)">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field
            label="Missed window (minutes)"
            hint="A dose becomes overdue this many minutes after the time. It can still be logged late."
          >
            <Input
              type="number"
              min={0}
              max={24 * 60}
              value={missed}
              onChange={(e) => setMissed(Number(e.target.value))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
