import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import type { Medication, Person, Routine, ScheduledAssignment } from '../types';
import { btn, EmptyHint, ErrorBanner, Field, Input, Modal, Select } from '../ui';

export function ScheduledPanel() {
  const [people, setPeople] = useState<Person[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [assigns, setAssigns] = useState<ScheduledAssignment[]>([]);
  const [routineId, setRoutineId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduledAssignment | 'new' | null>(null);

  const reload = async () => {
    try {
      const [p, r, m, a] = await Promise.all([
        api.listPeople(),
        api.listRoutines(),
        api.listMedications(),
        api.listScheduledAssignments(),
      ]);
      setPeople(p);
      setRoutines(r);
      setMeds(m);
      setAssigns(a);
      if (routineId === null && r.length) setRoutineId(r[0].id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const routine = routines.find((r) => r.id === routineId) ?? null;
  const inRoutine = useMemo(
    () => assigns.filter((a) => a.routine_id === routineId),
    [assigns, routineId]
  );
  const byPerson = useMemo(() => {
    const m = new Map<number, ScheduledAssignment[]>();
    for (const a of inRoutine) {
      const arr = m.get(a.person_id) ?? [];
      arr.push(a);
      m.set(a.person_id, arr);
    }
    return m;
  }, [inRoutine]);

  if (routines.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-h3 text-ink">Scheduled assignments</h2>
        <EmptyHint>Add at least one routine first.</EmptyHint>
      </div>
    );
  }
  if (meds.length === 0 || people.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-h3 text-ink">Scheduled assignments</h2>
        <EmptyHint>
          Add at least one {people.length === 0 ? 'person' : 'medication'} first.
        </EmptyHint>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-h3 text-ink">Scheduled assignments</h2>
        <button
          className={btn.primary}
          onClick={() => setEditing('new')}
          disabled={!routine}
        >
          + Add assignment
        </button>
      </div>
      <ErrorBanner error={error} />

      <div className="flex flex-wrap gap-2">
        {routines.map((r) => {
          const active = r.id === routineId;
          return (
            <button
              key={r.id}
              onClick={() => setRoutineId(r.id)}
              className={
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-button-md ' +
                (active
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
              }
            >
              <span>{r.name}</span>
              <span className={active ? 'text-on-dark-muted' : 'text-stone'}>
                {r.scheduled_time}
              </span>
            </button>
          );
        })}
      </div>

      {routine && inRoutine.length === 0 ? (
        <EmptyHint>
          No assignments for <strong>{routine.name}</strong> yet. Add one to start
          building the grid.
        </EmptyHint>
      ) : (
        <div className="flex flex-col gap-4">
          {people.map((p) => {
            const rows = byPerson.get(p.id) ?? [];
            if (rows.length === 0) return null;
            return (
              <div
                key={p.id}
                className="rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-h5 text-ink">{p.name}</span>
                  <span className="text-caption text-steel">
                    {p.requires_dispense ? 'Dispense + Taken' : 'Taken only'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {rows.map((a) => (
                    <AssignmentRow
                      key={a.id}
                      assignment={a}
                      meds={meds}
                      routine={routine!}
                      onEdit={() => setEditing(a)}
                      onChanged={reload}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && routine && (
        <ScheduledEdit
          assignment={editing === 'new' ? null : editing}
          routine={routine}
          people={people}
          meds={meds}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function AssignmentRow({
  assignment,
  meds,
  routine,
  onEdit,
  onChanged,
}: {
  assignment: ScheduledAssignment;
  meds: Medication[];
  routine: Routine;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const med = meds.find((m) => m.id === assignment.medication_id);
  const remove = async () => {
    if (!confirm('Remove this assignment? Future days only — past logs are kept.')) return;
    try {
      await api.deleteScheduledAssignment(assignment.id);
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  const time = assignment.time_override ?? routine.scheduled_time;
  const isCourse = assignment.start_date || assignment.end_date;
  return (
    <div className="flex items-center gap-3 rounded-md border border-hairline-soft bg-surface-soft p-3">
      <div className="flex flex-1 flex-col">
        <span className="text-body-md text-ink">
          {med?.proper_name ?? `#${assignment.medication_id}`}
          {assignment.dose_override && (
            <span className="ml-2 text-caption text-slate">
              · {assignment.dose_override}
            </span>
          )}
        </span>
        <span className="text-caption text-steel">
          {time}
          {assignment.time_override && ' (override)'}
          {isCourse && ` · course ${assignment.start_date ?? '…'} → ${assignment.end_date ?? '…'}`}
        </span>
      </div>
      <button className={btn.ghost} onClick={onEdit}>
        Edit
      </button>
      <button className={btn.ghost} onClick={remove}>
        ✕
      </button>
    </div>
  );
}

function ScheduledEdit({
  assignment,
  routine,
  people,
  meds,
  onClose,
  onSaved,
}: {
  assignment: ScheduledAssignment | null;
  routine: Routine;
  people: Person[];
  meds: Medication[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // For new assignments, allow selecting multiple people at once (shared assignment).
  const [personIds, setPersonIds] = useState<number[]>(
    assignment ? [assignment.person_id] : []
  );
  const [medId, setMedId] = useState<number | null>(
    assignment?.medication_id ?? meds[0]?.id ?? null
  );
  const [doseOverride, setDoseOverride] = useState(assignment?.dose_override ?? '');
  const [timeOverride, setTimeOverride] = useState(assignment?.time_override ?? '');
  const [missedOverride, setMissedOverride] = useState<string>(
    assignment?.missed_window_override === null || assignment?.missed_window_override === undefined
      ? ''
      : String(assignment.missed_window_override)
  );
  const [isCourse, setIsCourse] = useState(
    Boolean(assignment?.start_date || assignment?.end_date)
  );
  const [startDate, setStartDate] = useState(assignment?.start_date ?? '');
  const [endDate, setEndDate] = useState(assignment?.end_date ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePerson = (id: number) => {
    setPersonIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const save = async () => {
    setError(null);
    if (!medId) {
      setError('Pick a medication.');
      return;
    }
    if (personIds.length === 0) {
      setError('Pick at least one person.');
      return;
    }
    setBusy(true);
    try {
      const base = {
        routine_id: routine.id,
        medication_id: medId,
        dose_override: doseOverride.trim() || null,
        time_override: timeOverride || null,
        missed_window_override: missedOverride === '' ? null : Number(missedOverride),
        start_date: isCourse ? startDate || null : null,
        end_date: isCourse ? endDate || null : null,
      };
      if (assignment) {
        await api.updateScheduledAssignment(assignment.id, {
          ...base,
          person_id: personIds[0],
        });
      } else {
        for (const pid of personIds) {
          await api.createScheduledAssignment({ ...base, person_id: pid });
        }
      }
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
      title={assignment ? 'Edit assignment' : `New assignment — ${routine.name}`}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={btn.primary}
            onClick={save}
            disabled={busy || !medId || personIds.length === 0}
          >
            Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ErrorBanner error={error} />

        {!assignment && (
          <Field label="People (one or more — shared assignment)">
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const on = personIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePerson(p.id)}
                    className={
                      'rounded-full border px-4 py-2 text-button-md ' +
                      (on
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-hairline-strong bg-canvas text-ink active:bg-surface')
                    }
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Medication">
          <Select
            value={medId ?? ''}
            onChange={(e) => setMedId(Number(e.target.value))}
          >
            {meds.map((m) => (
              <option key={m.id} value={m.id}>
                {m.proper_name}
                {m.brand_name ? ` (${m.brand_name})` : ''} · {m.dose}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Dose override" hint="Leave blank to use the medication's default.">
            <Input
              value={doseOverride}
              onChange={(e) => setDoseOverride(e.target.value)}
              placeholder={meds.find((m) => m.id === medId)?.dose ?? ''}
            />
          </Field>
          <Field
            label="Time override"
            hint={`Routine default: ${routine.scheduled_time}`}
          >
            <Input
              type="time"
              value={timeOverride}
              onChange={(e) => setTimeOverride(e.target.value)}
            />
          </Field>
          <Field
            label="Missed window (min) override"
            hint={`Routine default: ${routine.missed_window_minutes}`}
          >
            <Input
              type="number"
              value={missedOverride}
              onChange={(e) => setMissedOverride(e.target.value)}
              min={0}
              max={24 * 60}
              placeholder=""
            />
          </Field>
        </div>

        <Field
          label="Course"
          hint="Leave off for an ongoing assignment. Turn on for a finite course (e.g. 5-day antibiotic)."
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCourse(!isCourse)}
              className={
                'rounded-full border px-4 py-2 text-button-md ' +
                (isCourse
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-hairline-strong bg-canvas text-ink')
              }
            >
              {isCourse ? 'Course (finite)' : 'Ongoing'}
            </button>
            {isCourse && (
              <>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-44"
                />
                <span className="text-caption text-stone">→</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-44"
                />
              </>
            )}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
