import { useEffect, useState } from 'react';
import { api } from '../api';
import type {
  AiModel,
  ExtractedMed,
  FoodTiming,
  Medication,
  Person,
  Routine,
} from '../types';
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
  const [people, setPeople] = useState<Person[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [aiModels, setAiModels] = useState<AiModel[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Medication | 'new' | null>(null);
  const [photoFlow, setPhotoFlow] = useState(false);

  const reload = () =>
    api.listMedications().then(setRows).catch((e: Error) => setError(e.message));

  useEffect(() => {
    reload();
    api.listPeople().then(setPeople).catch(() => {});
    api.listRoutines().then(setRoutines).catch(() => {});
    api
      .listAiModels()
      .then((r) => {
        setAiModels(r.models);
        setAiEnabled(r.enabled);
        setDefaultModel(r.default_model);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-ink">Medications</h2>
        <div className="flex gap-3">
          {aiEnabled && (
            <button className={btn.secondary} onClick={() => setPhotoFlow(true)}>
              📷 Add via photo
            </button>
          )}
          <button className={btn.primary} onClick={() => setEditing('new')}>
            + Add medication
          </button>
        </div>
      </div>
      {!aiEnabled && (
        <div className="rounded-md border border-hairline-soft bg-surface px-4 py-2 text-caption text-slate">
          Add an OpenRouter API key in Settings → AI medication extraction to enable
          photo capture.
        </div>
      )}
      <ErrorBanner error={error} />
      {rows.length === 0 ? (
        <EmptyHint>
          No medications yet. Add each medication once, then assign it to people from the
          Assignments tab.
        </EmptyHint>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rows.map((m) => (
            <MedicationRow
              key={m.id}
              med={m}
              people={people}
              onEdit={() => setEditing(m)}
              onChanged={reload}
            />
          ))}
        </div>
      )}
      {editing && (
        <MedicationEdit
          med={editing === 'new' ? null : editing}
          prefill={null}
          suggestedPersonId={null}
          suggestedRoutineId={null}
          people={people}
          routines={routines}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
      {photoFlow && (
        <PhotoExtractFlow
          aiModels={aiModels}
          defaultModel={defaultModel}
          people={people}
          routines={routines}
          onClose={() => setPhotoFlow(false)}
          onSaved={() => {
            setPhotoFlow(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function personName(people: Person[], id: number | null): string {
  if (id === null) return '';
  return people.find((p) => p.id === id)?.name ?? `#${id}`;
}

function MedicationRow({
  med,
  people,
  onEdit,
  onChanged,
}: {
  med: Medication;
  people: Person[];
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
        {(med.prescribed_to_person_id !== null || med.expiry_date) && (
          <span className="text-caption text-stone">
            {med.prescribed_to_person_id !== null
              ? `For ${personName(people, med.prescribed_to_person_id)}`
              : ''}
            {med.prescribed_to_person_id !== null && med.expiry_date ? ' · ' : ''}
            {med.expiry_date ? `exp ${med.expiry_date}` : ''}
          </span>
        )}
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

// ---- Photo extract flow ----

const MAX_EXTRACT_IMAGES = 8;

type PhotoFlowState =
  | { step: 'capture' }
  | { step: 'extracting' }
  | {
      step: 'review';
      images: string[];
      extracted: ExtractedMed;
      suggestedPersonId: number | null;
      suggestedRoutineId: number | null;
      modelUsed: string;
    };

function PhotoExtractFlow({
  aiModels,
  defaultModel,
  people,
  routines,
  onClose,
  onSaved,
}: {
  aiModels: AiModel[];
  defaultModel: string;
  people: Person[];
  routines: Routine[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [images, setImages] = useState<string[]>([]);
  const [model, setModel] = useState<string>(defaultModel || aiModels[0]?.slug || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<PhotoFlowState>({ step: 'capture' });

  const addImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const room = MAX_EXTRACT_IMAGES - images.length;
      const picked = Array.from(files).slice(0, Math.max(0, room));
      const uploads = await Promise.all(
        picked.map((f) => api.uploadImage(f, 'med-box').then((r) => r.url))
      );
      setImages((prev) => [...prev, ...uploads]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeImageAt = (i: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== i));

  const runExtraction = async () => {
    if (images.length === 0) return;
    setError(null);
    setBusy(true);
    setState({ step: 'extracting' });
    try {
      const res = await api.extractMedication({ image_urls: images, model });
      setState({
        step: 'review',
        images,
        extracted: res.extracted,
        suggestedPersonId: res.suggested_person_id,
        suggestedRoutineId: res.suggested_routine_id,
        modelUsed: res.model,
      });
    } catch (e) {
      setError((e as Error).message);
      setState({ step: 'capture' });
    } finally {
      setBusy(false);
    }
  };

  if (state.step === 'review') {
    return (
      <MedicationEdit
        med={null}
        prefill={{
          photoBox: state.images[0] ?? null,
          photoBoxBack: state.images[1] ?? null,
          extracted: state.extracted,
          modelUsed: state.modelUsed,
        }}
        suggestedPersonId={state.suggestedPersonId}
        suggestedRoutineId={state.suggestedRoutineId}
        people={people}
        routines={routines}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add medication via photo"
      footer={
        <>
          <button className={btn.secondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={btn.primary}
            onClick={runExtraction}
            disabled={busy || images.length === 0 || !model}
          >
            {state.step === 'extracting'
              ? 'Reading label…'
              : `Extract from ${images.length || ''} image${images.length === 1 ? '' : 's'}`.trim()}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <ErrorBanner error={error} />
        <p className="text-body-sm text-slate">
          Add as many photos as you need — different sides, the inner blister, or shots
          taken with the pharmacy label peeled back. The model sees them as views of the
          same medication and combines what's legible across them.
        </p>

        <Field label="Model">
          <Select value={model} onChange={(e) => setModel(e.target.value)}>
            {aiModels.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.label} — {m.blurb}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={`Images (${images.length}/${MAX_EXTRACT_IMAGES})`}>
          <div className="flex flex-wrap gap-3">
            {images.map((url, i) => (
              <div
                key={url}
                className="relative h-24 w-24 overflow-hidden rounded-md border border-hairline-soft"
              >
                <img src={url} alt={`upload ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImageAt(i)}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-on-primary"
                  aria-label={`Remove image ${i + 1}`}
                >
                  ✕
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] text-on-primary">
                    primary
                  </span>
                )}
              </div>
            ))}
            {images.length < MAX_EXTRACT_IMAGES && (
              <label
                className={
                  'flex h-24 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-hairline-strong text-stone hover:bg-surface ' +
                  (busy ? 'pointer-events-none opacity-50' : '')
                }
              >
                + Add
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addImages(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
          </div>
        </Field>
        <p className="text-caption text-stone">
          The first image becomes the medication's primary photo. The second is saved as
          the back-of-pack photo. Extras help extraction but aren't kept on the medication
          record.
        </p>

        {state.step === 'extracting' && (
          <div className="rounded-md bg-surface px-4 py-3 text-caption text-slate">
            Reading {images.length} image{images.length === 1 ? '' : 's'} with{' '}
            {aiModels.find((m) => m.slug === model)?.label ?? model}…
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---- Shared edit modal (also used for review-after-extract) ----

type Prefill = {
  photoBox: string;
  photoBoxBack: string | null;
  extracted: ExtractedMed;
  modelUsed: string;
} | null;

function MedicationEdit({
  med,
  prefill,
  suggestedPersonId,
  suggestedRoutineId,
  people,
  routines,
  onClose,
  onSaved,
}: {
  med: Medication | null;
  prefill: Prefill;
  suggestedPersonId: number | null;
  suggestedRoutineId: number | null;
  people: Person[];
  routines: Routine[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const e = prefill?.extracted ?? null;

  const [properName, setProperName] = useState(
    med?.proper_name ?? e?.proper_name ?? e?.active_ingredient ?? ''
  );
  const [brandName, setBrandName] = useState(med?.brand_name ?? e?.brand_name ?? '');
  const [nickname, setNickname] = useState(med?.nickname ?? '');
  const [dose, setDose] = useState(med?.dose ?? e?.dose ?? '');
  const [doseSize, setDoseSize] = useState(
    med?.dose_size ?? e?.dose_size ?? e?.strength ?? ''
  );
  const [foodTiming, setFoodTiming] = useState<FoodTiming>(
    med?.food_timing ?? e?.food_timing ?? 'none'
  );
  const [notes, setNotes] = useState(
    med?.notes ??
      [e?.notes, e?.instructions_raw && `Label: ${e.instructions_raw}`]
        .filter(Boolean)
        .join('\n') ??
      ''
  );
  const [photoBox, setPhotoBox] = useState<string | null>(
    med?.photo_box ?? prefill?.photoBox ?? null
  );
  const [photoBoxBack, setPhotoBoxBack] = useState<string | null>(
    med?.photo_box_back ?? prefill?.photoBoxBack ?? null
  );
  const [photoTablet, setPhotoTablet] = useState<string | null>(med?.photo_tablet ?? null);
  const [activeIngredient, setActiveIngredient] = useState(
    med?.active_ingredient ?? e?.active_ingredient ?? ''
  );
  const [strength, setStrength] = useState(med?.strength ?? e?.strength ?? '');
  const [form, setForm] = useState(med?.form ?? e?.form ?? '');
  const [quantityInPack, setQuantityInPack] = useState(
    med?.quantity_in_pack ?? e?.quantity_in_pack ?? ''
  );
  const [expiryDate, setExpiryDate] = useState(med?.expiry_date ?? e?.expiry_date ?? '');
  const [instructionsRaw, setInstructionsRaw] = useState(
    med?.instructions_raw ?? e?.instructions_raw ?? ''
  );
  const [prescribedToPersonId, setPrescribedToPersonId] = useState<number | ''>(
    med?.prescribed_to_person_id ?? suggestedPersonId ?? ''
  );

  // For new meds coming from the photo flow, optionally create a scheduled_assignment
  // in the same save. The person side is whatever Prescribed-to is set to.
  const canLinkRoutine = !med;
  const [linkRoutineId, setLinkRoutineId] = useState<number | ''>(
    suggestedRoutineId ?? ''
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadTo = async (f: File, kind: 'med-box' | 'med-box-back' | 'med-tablet') => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.uploadImage(f, kind);
      if (kind === 'med-box') setPhotoBox(url);
      else if (kind === 'med-box-back') setPhotoBoxBack(url);
      else setPhotoTablet(url);
    } catch (err) {
      setError((err as Error).message);
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
        photo_box_back: photoBoxBack,
        photo_tablet: photoTablet,
        active_ingredient: activeIngredient.trim() || null,
        strength: strength.trim() || null,
        form: form.trim() || null,
        quantity_in_pack: quantityInPack.trim() || null,
        expiry_date: expiryDate.trim() || null,
        instructions_raw: instructionsRaw.trim() || null,
        prescribed_to_person_id:
          prescribedToPersonId === '' ? null : Number(prescribedToPersonId),
      };
      const saved = med
        ? await api.updateMedication(med.id, payload)
        : await api.createMedication(payload);

      // For new medications, if we know both the person and a routine, create
      // the scheduled assignment in the same save.
      if (!med && prescribedToPersonId !== '' && linkRoutineId !== '') {
        await api.createScheduledAssignment({
          medication_id: saved.id,
          person_id: Number(prescribedToPersonId),
          routine_id: Number(linkRoutineId),
        });
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        med
          ? `Edit ${med.proper_name}`
          : prefill
            ? 'Review extracted details'
            : 'Add medication'
      }
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
        {prefill && (
          <div className="rounded-md border border-hairline-soft bg-surface px-4 py-3 text-caption text-slate">
            Read by <strong>{prefill.modelUsed}</strong>. Review every field before saving
            — AI can misread small print or dosing instructions.
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Proper name (active ingredient)">
            <Input
              value={properName}
              onChange={(ev) => setProperName(ev.target.value)}
              placeholder="e.g. Paracetamol"
              autoFocus
            />
          </Field>
          <Field label="Brand name">
            <Input
              value={brandName}
              onChange={(ev) => setBrandName(ev.target.value)}
              placeholder="e.g. Panadol"
            />
          </Field>
        </div>
        <Field label="Household nickname">
          <Input
            value={nickname}
            onChange={(ev) => setNickname(ev.target.value)}
            placeholder='e.g. "The pink one"'
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Dose (per administration)">
            <Input
              value={dose}
              onChange={(ev) => setDose(ev.target.value)}
              placeholder='e.g. "2 tablets" or "5 ml"'
            />
          </Field>
          <Field label="Dose size (strength per unit)">
            <Input
              value={doseSize}
              onChange={(ev) => setDoseSize(ev.target.value)}
              placeholder='e.g. "500 mg"'
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Form">
            <Input
              value={form}
              onChange={(ev) => setForm(ev.target.value)}
              placeholder="tablet, capsule, liquid…"
            />
          </Field>
          <Field label="Strength on pack">
            <Input
              value={strength}
              onChange={(ev) => setStrength(ev.target.value)}
              placeholder="500 mg"
            />
          </Field>
        </div>
        <Field label="Active ingredient (full)">
          <Input
            value={activeIngredient}
            onChange={(ev) => setActiveIngredient(ev.target.value)}
            placeholder="e.g. Acetaminophen"
          />
        </Field>
        <Field label="Food timing">
          <Select
            value={foodTiming}
            onChange={(ev) => setFoodTiming(ev.target.value as FoodTiming)}
          >
            {(Object.keys(FOOD_LABEL) as FoodTiming[]).map((k) => (
              <option key={k} value={k}>
                {FOOD_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity in pack">
            <Input
              value={quantityInPack}
              onChange={(ev) => setQuantityInPack(ev.target.value)}
              placeholder="e.g. 30 tablets"
            />
          </Field>
          <Field label="Expiry">
            <Input
              value={expiryDate}
              onChange={(ev) => setExpiryDate(ev.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </Field>
        </div>

        <Field
          label="Prescribed to"
          hint="Optional — leave blank for over-the-counter items like vitamins."
        >
          <Select
            value={String(prescribedToPersonId)}
            onChange={(ev) =>
              setPrescribedToPersonId(ev.target.value ? Number(ev.target.value) : '')
            }
          >
            <option value="">— none / OTC —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.id === suggestedPersonId ? ' ★ (suggested)' : ''}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Label instructions (verbatim)">
          <Textarea
            value={instructionsRaw}
            onChange={(ev) => setInstructionsRaw(ev.target.value)}
            placeholder='e.g. "Take one tablet twice daily with food"'
          />
        </Field>
        <Field label="Notes">
          <Textarea
            value={notes}
            onChange={(ev) => setNotes(ev.target.value)}
            placeholder='e.g. "shake well", "do not crush"'
          />
        </Field>

        {canLinkRoutine && (
          <div className="rounded-xl border border-hairline-soft bg-surface p-4">
            <h3 className="text-h5 text-ink">Add to a routine (optional)</h3>
            <p className="text-caption text-slate">
              {prescribedToPersonId === ''
                ? 'Pick a person above first, then choose the routine to add this medication to.'
                : `Adds a scheduled dose for ${
                    personName(people, Number(prescribedToPersonId)) || 'this person'
                  } at the chosen routine. Skip to assign later.`}
            </p>
            <div className="mt-3 max-w-md">
              <Field label="Routine">
                <Select
                  value={String(linkRoutineId)}
                  onChange={(ev) =>
                    setLinkRoutineId(ev.target.value ? Number(ev.target.value) : '')
                  }
                  disabled={prescribedToPersonId === ''}
                >
                  <option value="">— none —</option>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.scheduled_time})
                      {r.id === suggestedRoutineId ? ' ★ (suggested)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <PhotoField
            label="Box / front"
            url={photoBox}
            onPick={(f) => uploadTo(f, 'med-box')}
            onClear={() => setPhotoBox(null)}
          />
          <PhotoField
            label="Box / back"
            url={photoBoxBack}
            onPick={(f) => uploadTo(f, 'med-box-back')}
            onClear={() => setPhotoBoxBack(null)}
          />
          <PhotoField
            label="Tablet"
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
