import type { FoodTiming } from '../types';

export type MedDetail = {
  proper_name: string;
  brand_name: string | null;
  nickname: string | null;
  dose: string;
  dose_size: string | null;
  food_timing: FoodTiming;
  photo_box: string | null;
  photo_tablet: string | null;
  notes?: string | null;
  due_time?: string | null;
};

const FOOD_LABEL: Record<FoodTiming, string> = {
  with_food: 'With food',
  before_food: 'Before food',
  empty_stomach: 'Empty stomach',
  none: 'No food constraint',
};

/** Brief §6: "tap to dismiss". The whole scrim is the dismiss target so a
 *  fingertip anywhere outside the card closes it. The header is the only
 *  trigger for opening — the cells never open this card. */
export function MedDetailCard({ med, onClose }: { med: MedDetail; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-feature bg-canvas shadow-elev-4"
      >
        <header className="flex items-start gap-6 px-8 py-6">
          <div className="flex-1">
            <div className="text-micro-uppercase text-steel">Medication</div>
            <h2 className="text-h2 text-ink">{med.proper_name}</h2>
            <div className="mt-1 text-body-md text-slate">
              {[med.brand_name, med.nickname].filter(Boolean).join(' · ') || '—'}
            </div>
            {med.due_time && (
              <div className="text-caption text-stone mt-1">Due {med.due_time}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-surface px-4 py-2 text-button-md text-ink active:bg-hairline"
            aria-label="Close"
          >
            Done
          </button>
        </header>
        <div className="grid grid-cols-2 gap-4 px-8">
          <PhotoTile label="Box" url={med.photo_box} />
          <PhotoTile label="Tablet" url={med.photo_tablet} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 px-8 pb-8 text-body-md">
          <Pair k="Dose" v={med.dose} />
          <Pair k="Dose size" v={med.dose_size ?? '—'} />
          <Pair k="Food timing" v={FOOD_LABEL[med.food_timing]} />
          <Pair k="Notes" v={med.notes ?? '—'} wide />
        </dl>
      </div>
    </div>
  );
}

function Pair({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-micro-uppercase text-steel">{k}</dt>
      <dd className="text-body-md text-ink">{v}</dd>
    </div>
  );
}

function PhotoTile({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-micro-uppercase text-steel">{label}</div>
      {url ? (
        <img
          src={url}
          alt={label}
          className="aspect-[4/3] w-full rounded-xl border border-hairline-soft object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-hairline-soft bg-surface text-stone">
          No photo
        </div>
      )}
    </div>
  );
}
