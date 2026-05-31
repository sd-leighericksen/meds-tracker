import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AwayPeriod, Person } from '../types';
import { btn, EmptyHint, ErrorBanner, Field, Input, Modal, Select } from '../ui';

export function AwayPanel() {
  const [people, setPeople] = useState<Person[]>([]);
  const [rows, setRows] = useState<AwayPeriod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const reload = async () => {
    try {
      const [p, a] = await Promise.all([api.listPeople(), api.listAway()]);
      setPeople(p);
      setRows(a);
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
        <h2 className="text-h3 text-ink">Away periods</h2>
        <button
          className={btn.primary}
          onClick={() => setAdding(true)}
          disabled={people.length === 0}
        >
          + Add away
        </button>
      </div>
      <p className="text-body-sm text-slate">
        On away days, doses log as <strong>away</strong> rather than missed and no missed
        webhook fires. Handy for part-time kids across two households.
      </p>
      <ErrorBanner error={error} />
      {rows.length === 0 ? (
        <EmptyHint>No upcoming or past away periods.</EmptyHint>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <AwayRow key={r.id} row={r} people={people} onChanged={reload} />
          ))}
        </div>
      )}
      {adding && (
        <AwayCreate
          people={people}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void reload();
          }}
        />
      )}
    </div>
  );
}

function AwayRow({
  row,
  people,
  onChanged,
}: {
  row: AwayPeriod;
  people: Person[];
  onChanged: () => void;
}) {
  const person = people.find((p) => p.id === row.person_id);
  const remove = async () => {
    if (!confirm('Remove this away period?')) return;
    try {
      await api.deleteAway(row.id);
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <div className="flex flex-1 flex-col">
        <span className="text-h5 text-ink">
          {person?.name ?? `#${row.person_id}`}
        </span>
        <span className="text-caption text-slate">
          {row.start_date} → {row.end_date}
          {row.note ? ` · ${row.note}` : ''}
        </span>
      </div>
      <button className={btn.ghost} onClick={remove}>
        Remove
      </button>
    </div>
  );
}

function AwayCreate({
  people,
  onClose,
  onSaved,
}: {
  people: Person[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [personId, setPersonId] = useState<number | null>(people[0]?.id ?? null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!personId) return;
    if (startDate > endDate) {
      setError('Start date must be on or before end date.');
      return;
    }
    setBusy(true);
    try {
      await api.createAway({
        person_id: personId,
        start_date: startDate,
        end_date: endDate,
        note: note.trim() || null,
      });
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
      title="Add away period"
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
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="End date" hint="Inclusive.">
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Note (optional)">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. With Dad / school camp"
          />
        </Field>
      </div>
    </Modal>
  );
}
