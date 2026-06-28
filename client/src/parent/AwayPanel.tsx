import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Person } from '../types';
import { EmptyHint, ErrorBanner, inputCls } from '../ui';

export function AwayPanel() {
  const [people, setPeople] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const p = await api.listPeople();
      setPeople(p);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const toggle = async (person: Person) => {
    setError(null);
    try {
      await api.updatePerson(person.id, {
        is_away: !person.is_away,
        away_note: person.is_away ? null : person.away_note,
      });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const saveNote = async (person: Person, note: string) => {
    setError(null);
    try {
      await api.updatePerson(person.id, { away_note: note.trim() || null });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-ink">Away</h2>
      </div>
      <p className="text-body-sm text-slate">
        Mark someone as away and their doses log as <strong>away</strong> rather
        than missed. Handy for part-time kids across two households.
      </p>
      <ErrorBanner error={error} />
      {people.length === 0 ? (
        <EmptyHint>No people yet. Add people in the People section.</EmptyHint>
      ) : (
        <div className="flex flex-col gap-3">
          {people.map((p) => (
            <PersonAwayCard
              key={p.id}
              person={p}
              onToggle={() => toggle(p)}
              onSaveNote={(note) => saveNote(p, note)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonAwayCard({
  person,
  onToggle,
  onSaveNote,
}: {
  person: Person;
  onToggle: () => void;
  onSaveNote: (note: string) => void;
}) {
  const [note, setNote] = useState(person.away_note ?? '');

  useEffect(() => {
    setNote(person.away_note ?? '');
  }, [person.away_note]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <div className="flex items-center gap-4">
        <Avatar src={person.image} name={person.name} away={person.is_away} />
        <div className="flex flex-1 flex-col">
          <span className="text-h5 text-ink">{person.name}</span>
          {person.is_child && (
            <span className="text-caption text-stone">Child</span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={
            'rounded-full border px-5 py-2 text-button-md transition-colors ' +
            (person.is_away
              ? 'bg-coral-light text-coral-dark border-coral-light'
              : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
          }
        >
          {person.is_away ? 'Away' : 'At home'}
        </button>
      </div>
      {person.is_away && (
        <input
          className={inputCls + ' py-2 text-body-sm'}
          placeholder="Note, e.g. With Dad / school camp (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onSaveNote(note)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSaveNote(note);
          }}
        />
      )}
    </div>
  );
}

function Avatar({
  src,
  name,
  away,
}: {
  src: string | null;
  name: string;
  away: boolean;
}) {
  const inner = src ? (
    <img src={src} alt={name} className="h-12 w-12 rounded-full object-cover" />
  ) : (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-light text-h5 text-yellow-dark">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
  return (
    <div className={away ? 'opacity-60 grayscale' : ''}>{inner}</div>
  );
}
