import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Medication, Person, PrnAssignment } from '../types';
import { btn, EmptyHint, ErrorBanner, Field, Input, Modal, Select } from '../ui';

export function PrnPanel() {
  const [people, setPeople] = useState<Person[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [assigns, setAssigns] = useState<PrnAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PrnAssignment | 'new' | null>(null);

  const reload = async () => {
    try {
      const [p, m, a] = await Promise.all([
        api.listPeople(),
        api.listMedications(),
        api.listPrnAssignments(),
      ]);
      setPeople(p);
      setMeds(m);
      setAssigns(a);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-ink">PRN (as-needed)</h2>
        <button
          className={btn.primary}
          onClick={() => setEditing('new')}
          disabled={people.length === 0 || meds.length === 0}
        >
          + Add PRN
        </button>
      </div>
      <p className="text-body-sm text-slate">
        PRN doses are not tied to a routine. The minimum interval is a memory aid only — it
        warns the user but never blocks a dose.
      </p>
      <ErrorBanner error={error} />
      {assigns.length === 0 ? (
        <EmptyHint>
          No PRN assignments yet. Add a painkiller, antihistamine, or inhaler with a daily
          cap and minimum interval.
        </EmptyHint>
      ) : (
        <div className="flex flex-col gap-2">
          {assigns.map((a) => (
            <PrnRow
              key={a.id}
              assignment={a}
              meds={meds}
              people={people}
              onEdit={() => setEditing(a)}
              onChanged={reload}
            />
          ))}
        </div>
      )}
      {editing && (
        <PrnEdit
          assignment={editing === 'new' ? null : editing}
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

function PrnRow({
  assignment,
  people,
  meds,
  onEdit,
  onChanged,
}: {
  assignment: PrnAssignment;
  people: Person[];
  meds: Medication[];
  onEdit: () => void;
  onChanged: () => void;
}) {
  const person = people.find((p) => p.id === assignment.person_id);
  const med = meds.find((m) => m.id === assignment.medication_id);
  const remove = async () => {
    if (!confirm('Remove this PRN assignment? Past doses are kept.')) return;
    try {
      await api.deletePrnAssignment(assignment.id);
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <div className="flex flex-1 flex-col">
        <span className="text-h5 text-ink">
          {person?.name ?? `#${assignment.person_id}`} ·{' '}
          {med?.proper_name ?? `#${assignment.medication_id}`}
        </span>
        <span className="text-caption text-slate">
          {assignment.dose_override ?? med?.dose ?? ''} · max {assignment.max_per_day}/day ·
          ≥ {assignment.min_interval_hours}h between
          {assignment.start_date || assignment.end_date
            ? ` · ${assignment.start_date ?? '…'} → ${assignment.end_date ?? '…'}`
            : ''}
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

function PrnEdit({
  assignment,
  people,
  meds,
  onClose,
  onSaved,
}: {
  assignment: PrnAssignment | null;
  people: Person[];
  meds: Medication[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [personId, setPersonId] = useState<number | null>(
    assignment?.person_id ?? people[0]?.id ?? null
  );
  const [medId, setMedId] = useState<number | null>(
    assignment?.medication_id ?? meds[0]?.id ?? null
  );
  const [doseOverride, setDoseOverride] = useState(assignment?.dose_override ?? '');
  const [maxPerDay, setMaxPerDay] = useState(assignment?.max_per_day ?? 4);
  const [minIntervalHours, setMinIntervalHours] = useState(
    assignment?.min_interval_hours ?? 4
  );
  const [hasCourse, setHasCourse] = useState(
    Boolean(assignment?.start_date || assignment?.end_date)
  );
  const [startDate, setStartDate] = useState(assignment?.start_date ?? '');
  const [endDate, setEndDate] = useState(assignment?.end_date ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!personId || !medId) {
      setError('Pick a person and a medication.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        person_id: personId,
        medication_id: medId,
        dose_override: doseOverride.trim() || null,
        max_per_day: maxPerDay,
        min_interval_hours: minIntervalHours,
        start_date: hasCourse ? startDate || null : null,
        end_date: hasCourse ? endDate || null : null,
      };
      if (assignment) await api.updatePrnAssignment(assignment.id, payload);
      else await api.createPrnAssignment(payload);
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
      title={assignment ? 'Edit PRN assignment' : 'New PRN assignment'}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={btn.primary} onClick={save} disabled={busy}>
            Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Person">
            <Select
              value={personId ?? ''}
              onChange={(e) => setPersonId(Number(e.target.value))}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Medication">
            <Select
              value={medId ?? ''}
              onChange={(e) => setMedId(Number(e.target.value))}
            >
              {meds.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.proper_name}
                  {m.brand_name ? ` (${m.brand_name})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Dose override" hint="Leave blank for the med's default.">
            <Input
              value={doseOverride}
              onChange={(e) => setDoseOverride(e.target.value)}
              placeholder={meds.find((m) => m.id === medId)?.dose ?? ''}
            />
          </Field>
          <Field label="Max per day">
            <Input
              type="number"
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(Number(e.target.value))}
              min={1}
              max={100}
            />
          </Field>
          <Field
            label="Min interval (hours)"
            hint="Memory aid only. The app warns but never blocks."
          >
            <Input
              type="number"
              step={0.5}
              value={minIntervalHours}
              onChange={(e) => setMinIntervalHours(Number(e.target.value))}
              min={0}
              max={48}
            />
          </Field>
        </div>
        <Field label="Course" hint="Optional. Date range outside which the PRN doesn't apply.">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHasCourse(!hasCourse)}
              className={
                'rounded-full border px-4 py-2 text-button-md ' +
                (hasCourse
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-hairline-strong bg-canvas text-ink')
              }
            >
              {hasCourse ? 'Course' : 'No course'}
            </button>
            {hasCourse && (
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
