import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Person } from '../types';
import {
  btn,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Toggle,
  EmptyHint,
} from '../ui';

export function PeoplePanel() {
  const [rows, setRows] = useState<Person[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);

  const reload = () =>
    api
      .listPeople()
      .then(setRows)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-ink">People</h2>
        <button className={btn.primary} onClick={() => setEditing('new')}>
          + Add person
        </button>
      </div>
      <ErrorBanner error={error} />
      {rows.length === 0 ? (
        <EmptyHint>No people yet. Add the people in your household.</EmptyHint>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <PersonCard key={p.id} person={p} onEdit={() => setEditing(p)} onChanged={reload} />
          ))}
        </div>
      )}
      {editing && (
        <PersonEdit
          person={editing === 'new' ? null : editing}
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

function PersonCard({
  person,
  onEdit,
  onChanged,
}: {
  person: Person;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const remove = async () => {
    if (!confirm(`Remove ${person.name}? Their existing logs are kept.`)) return;
    try {
      await api.deletePerson(person.id);
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <Avatar src={person.image} name={person.name} />
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-h5 text-ink">{person.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-caption-bold ${person.is_child ? 'bg-brand-rose text-charcoal' : 'bg-surface text-stone'}`}>
            {person.is_child ? 'Child' : 'Adult'}
          </span>
        </div>
        <span className="text-caption text-slate">
          {person.requires_dispense ? 'Dispense + Taken' : 'Taken only'}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <button className={btn.secondary} onClick={onEdit}>
          Edit
        </button>
        <button className={btn.ghost} onClick={remove}>
          Remove
        </button>
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src)
    return (
      <img
        src={src}
        alt={name}
        className="h-14 w-14 rounded-full object-cover"
      />
    );
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-light text-h4 text-yellow-dark">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function PersonEdit({
  person,
  onClose,
  onSaved,
}: {
  person: Person | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(person?.name ?? '');
  const [image, setImage] = useState<string | null>(person?.image ?? null);
  const [requiresDispense, setRequiresDispense] = useState(
    person?.requires_dispense ?? false
  );
  const [isChild, setIsChild] = useState(person?.is_child ?? false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.uploadImage(f, 'person');
      setImage(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const payload = {
        name: name.trim(),
        image,
        requires_dispense: requiresDispense,
        is_child: isChild,
      };
      if (person) await api.updatePerson(person.id, payload);
      else await api.createPerson(payload);
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
      title={person ? `Edit ${person.name}` : 'Add person'}
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
        <div className="flex items-center gap-5">
          <Avatar src={image} name={name || '?'} />
          <div className="flex flex-col gap-1">
            <label className={btn.secondary + ' cursor-pointer'}>
              {image ? 'Replace photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
            </label>
            {image && (
              <button className={btn.ghost} onClick={() => setImage(null)}>
                Clear photo
              </button>
            )}
          </div>
        </div>
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mia"
            autoFocus
          />
        </Field>
        <Field label="Type">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsChild(false)}
              className={
                'rounded-full border px-4 py-2 text-button-md ' +
                (!isChild
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
              }
            >
              Adult
            </button>
            <button
              type="button"
              onClick={() => setIsChild(true)}
              className={
                'rounded-full border px-4 py-2 text-button-md ' +
                (isChild
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
              }
            >
              Child
            </button>
          </div>
        </Field>
        <Field
          label="Requires dispense"
          hint="When on, the cell shows two checkboxes (dispensed + taken). When off, just taken."
        >
          <div>
            <Toggle
              checked={requiresDispense}
              onChange={setRequiresDispense}
              label={requiresDispense ? 'On' : 'Off'}
            />
          </div>
        </Field>
      </div>
    </Modal>
  );
}
