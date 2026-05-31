import { useEffect, useState } from 'react';
import { api } from '../api';
import type { FoodTiming, Medication } from '../types';
import {
  btn,
  EmptyHint,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from '../ui';

const FOOD_LABEL: Record<FoodTiming, string> = {
  with_food: 'With food',
  before_food: 'Before food',
  empty_stomach: 'Empty stomach',
  none: 'No constraint',
};

export function MedicationsPanel() {
  const [rows, setRows] = useState<Medication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Medication | 'new' | null>(null);

  const reload = () =>
    api.listMedications().then(setRows).catch((e: Error) => setError(e.message));

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-ink">Medications</h2>
        <button className={btn.primary} onClick={() => setEditing('new')}>
          + Add medication
        </button>
      </div>
      <ErrorBanner error={error} />
      {rows.length === 0 ? (
        <EmptyHint>
          No medications yet. Add each medication once, then assign it to people from the
          Assignments tab.
        </EmptyHint>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((m) => (
            <MedicationRow key={m.id} med={m} onEdit={() => setEditing(m)} onChanged={reload} />
          ))}
        </div>
      )}
      {editing && (
        <MedicationEdit
          med={editing === 'new' ? null : editing}
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

function MedicationRow({
  med,
  onEdit,
  onChanged,
}: {
  med: Medication;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const remove = async () => {
    if (!confirm(`Remove ${med.proper_name}? Past logs are kept; current assignments will be removed.`))
      return;
    try {
      await api.deleteMedication(med.id);
      onChanged();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  return (
    <div className="flex gap-4 rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <Thumb src={med.photo_box} alt={med.proper_name} />
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-h5 text-ink">{med.proper_name}</span>
        <span className="text-caption text-slate">
          {[med.brand_name, med.nickname].filter(Boolean).join(' · ') || '—'}
        </span>
        <span className="text-caption text-steel">
          {med.dose}
          {med.dose_size ? ` · ${med.dose_size}` : ''} · {FOOD_LABEL[med.food_timing]}
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

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (src) return <img src={src} alt={alt} className="h-16 w-16 rounded-md object-cover" />;
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-md bg-surface text-stone">
      —
    </div>
  );
}

function MedicationEdit({
  med,
  onClose,
  onSaved,
}: {
  med: Medication | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [properName, setProperName] = useState(med?.proper_name ?? '');
  const [brandName, setBrandName] = useState(med?.brand_name ?? '');
  const [nickname, setNickname] = useState(med?.nickname ?? '');
  const [dose, setDose] = useState(med?.dose ?? '');
  const [doseSize, setDoseSize] = useState(med?.dose_size ?? '');
  const [foodTiming, setFoodTiming] = useState<FoodTiming>(med?.food_timing ?? 'none');
  const [notes, setNotes] = useState(med?.notes ?? '');
  const [photoBox, setPhotoBox] = useState<string | null>(med?.photo_box ?? null);
  const [photoTablet, setPhotoTablet] = useState<string | null>(med?.photo_tablet ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadTo = async (f: File, kind: 'med-box' | 'med-tablet') => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.uploadImage(f, kind);
      if (kind === 'med-box') setPhotoBox(url);
      else setPhotoTablet(url);
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
        proper_name: properName.trim(),
        brand_name: brandName.trim() || null,
        nickname: nickname.trim() || null,
        dose: dose.trim(),
        dose_size: doseSize.trim() || null,
        food_timing: foodTiming,
        notes: notes.trim() || null,
        photo_box: photoBox,
        photo_tablet: photoTablet,
      };
      if (med) await api.updateMedication(med.id, payload);
      else await api.createMedication(payload);
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
      title={med ? `Edit ${med.proper_name}` : 'Add medication'}
      footer={
        <>
          <button className={btn.secondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={btn.primary}
            onClick={save}
            disabled={busy || !properName.trim() || !dose.trim()}
          >
            Save
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ErrorBanner error={error} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Proper name (active ingredient)">
            <Input
              value={properName}
              onChange={(e) => setProperName(e.target.value)}
              placeholder="e.g. Paracetamol"
              autoFocus
            />
          </Field>
          <Field label="Brand name">
            <Input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="e.g. Panadol"
            />
          </Field>
        </div>
        <Field label="Household nickname">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder='e.g. "The pink one"'
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dose (per administration)">
            <Input
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder='e.g. "2 tablets" or "5 ml"'
            />
          </Field>
          <Field label="Dose size (strength per unit)">
            <Input
              value={doseSize}
              onChange={(e) => setDoseSize(e.target.value)}
              placeholder='e.g. "500 mg"'
            />
          </Field>
        </div>
        <Field label="Food timing">
          <Select
            value={foodTiming}
            onChange={(e) => setFoodTiming(e.target.value as FoodTiming)}
          >
            {(Object.keys(FOOD_LABEL) as FoodTiming[]).map((k) => (
              <option key={k} value={k}>
                {FOOD_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g. "shake well", "do not crush"'
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <PhotoField
            label="Box photo"
            url={photoBox}
            onPick={(f) => uploadTo(f, 'med-box')}
            onClear={() => setPhotoBox(null)}
          />
          <PhotoField
            label="Tablet photo"
            url={photoTablet}
            onPick={(f) => uploadTo(f, 'med-tablet')}
            onClear={() => setPhotoTablet(null)}
          />
        </div>
      </div>
    </Modal>
  );
}

function PhotoField({
  label,
  url,
  onPick,
  onClear,
}: {
  label: string;
  url: string | null;
  onPick: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        {url ? (
          <img src={url} alt={label} className="h-20 w-20 rounded-md object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md bg-surface text-stone">
            —
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className={btn.secondary + ' cursor-pointer'}>
            {url ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
          </label>
          {url && (
            <button className={btn.ghost} onClick={onClear} type="button">
              Clear
            </button>
          )}
        </div>
      </div>
    </Field>
  );
}
