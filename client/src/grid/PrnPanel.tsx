import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import type { Settings } from '../types';
import { DispenseByPicker } from './DispenseByPicker';
import { MedDetailCard, type MedDetail } from './MedDetailCard';
import type { PrnItem, PrnLog, PrnToday } from './types';

const PRN_POLL_MS = 30_000;

export function PrnPanel({
  settings,
  onAskDispenseBy: _,
  onOpenDetail: openMedDetail,
}: {
  settings: Settings | null;
  onAskDispenseBy: (item: PrnItem) => void;
  onOpenDetail: (m: MedDetail) => void;
}) {
  const [data, setData] = useState<PrnToday | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MedDetail | null>(null);
  const [pendingAttribution, setPendingAttribution] = useState<PrnLog | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await api.getPrnToday());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const t = setInterval(reload, PRN_POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  if (!data) return null;

  const promptOnDispense =
    !!settings?.dispensed_by_required && settings.parent_names.length > 0;

  // Group by person.
  const byPerson = new Map<number, PrnItem[]>();
  for (const it of data.items) {
    const arr = byPerson.get(it.person_id) ?? [];
    arr.push(it);
    byPerson.set(it.person_id, arr);
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-h3 text-ink">As-needed</h2>
        <p className="text-caption text-stone">
          Memory aid only — interval warnings never block a dose.
        </p>
      </div>
      {error && (
        <div className="mb-3 rounded-md border border-brand-red-dark/40 bg-brand-red/60 px-4 py-2 text-body-sm text-brand-red-dark">
          {error}
        </div>
      )}
      {data.items.length === 0 ? (
        <div className="rounded-3xl border border-hairline-soft bg-canvas p-6 text-center text-body-md text-slate">
          No PRN medications configured.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...byPerson.entries()].map(([personId, items]) => (
            <PersonPrnCard
              key={personId}
              items={items}
              promptOnDispense={promptOnDispense}
              onReload={reload}
              onAskDispenseBy={(log) => setPendingAttribution(log)}
              onOpenDetail={(m) => {
                openMedDetail(m);
                setDetail(m);
              }}
            />
          ))}
        </div>
      )}

      {detail && <MedDetailCard med={detail} onClose={() => setDetail(null)} />}

      {pendingAttribution && settings && (
        <DispenseByPicker
          names={settings.parent_names}
          onPick={async (name) => {
            // The dose has already fired dose.dispensed + dose.taken. PATCH
            // only updates the attribution — no second webhook fire.
            await api.attributePrnLog(pendingAttribution.id, name);
            setPendingAttribution(null);
            void reload();
          }}
          onSkip={() => setPendingAttribution(null)}
        />
      )}
    </section>
  );
}

function PersonPrnCard({
  items,
  promptOnDispense,
  onReload,
  onAskDispenseBy,
  onOpenDetail,
}: {
  items: PrnItem[];
  promptOnDispense: boolean;
  onReload: () => void;
  onAskDispenseBy: (l: PrnLog) => void;
  onOpenDetail: (m: MedDetail) => void;
}) {
  const name = items[0]?.person_name ?? '';
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <div className="text-h5 text-ink">{name}</div>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <PrnRow
            key={it.assignment_id}
            item={it}
            promptOnDispense={promptOnDispense}
            onReload={onReload}
            onAskDispenseBy={onAskDispenseBy}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </ul>
    </div>
  );
}

function PrnRow({
  item,
  promptOnDispense,
  onReload,
  onAskDispenseBy,
  onOpenDetail,
}: {
  item: PrnItem;
  promptOnDispense: boolean;
  onReload: () => void;
  onAskDispenseBy: (l: PrnLog) => void;
  onOpenDetail: (m: MedDetail) => void;
}) {
  const atMax = item.taken_today >= item.max_per_day;
  const sinceLast = useSinceLast(item.last_taken_at);
  const intervalWarn =
    item.last_taken_at !== null &&
    sinceLast.hours !== null &&
    sinceLast.hours < item.min_interval_hours;

  const log = async () => {
    const created = await api.logPrnDose({
      assignment_id: item.assignment_id,
      dispensed: item.person_requires_dispense,
    });
    if (item.person_requires_dispense && promptOnDispense) {
      onAskDispenseBy(created);
    }
    onReload();
  };

  const undoLast = async () => {
    const last = item.today_logs.at(-1);
    if (!last) return;
    if (!confirm('Remove the most recent dose? Mis-tap correction only.')) return;
    await api.deletePrnLog(last.id);
    onReload();
  };

  return (
    <li className="rounded-md border border-hairline-soft bg-surface-soft p-3">
      <div className="flex items-start gap-3">
        <button
          onClick={() =>
            onOpenDetail({
              proper_name: item.med.proper_name,
              brand_name: item.med.brand_name,
              nickname: item.med.nickname,
              dose: item.med.dose,
              dose_size: item.med.dose_size,
              food_timing: item.med.food_timing,
              photo_box: item.med.photo_box,
              photo_tablet: item.med.photo_tablet,
              notes: null,
            })
          }
          className="flex-1 text-left active:opacity-70"
        >
          <div className="text-body-md text-ink">{item.med.proper_name}</div>
          <div className="text-caption text-slate">
            {item.med.dose}
            {item.med.dose_size ? ` · ${item.med.dose_size}` : ''} ·{' '}
            <span className={atMax ? 'text-brand-red-dark' : ''}>
              {item.taken_today}/{item.max_per_day} today
            </span>
          </div>
          {item.last_taken_at && (
            <div className={'text-caption ' + (intervalWarn ? 'text-brand-red-dark' : 'text-stone')}>
              last dose {sinceLast.text}
              {intervalWarn && ` · interval ${item.min_interval_hours}h`}
            </div>
          )}
        </button>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={log}
            disabled={atMax}
            className={
              'rounded-full px-4 py-2 text-button-md disabled:opacity-50 ' +
              (atMax
                ? 'bg-surface text-stone'
                : 'bg-primary text-on-primary active:bg-charcoal')
            }
          >
            {atMax ? 'Maxed out' : '+ Dose'}
          </button>
          {item.taken_today > 0 && (
            <button
              onClick={undoLast}
              className="text-caption text-steel underline-offset-2 active:underline"
            >
              Undo last
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function useSinceLast(ts: string | null) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  void tick;
  if (!ts) return { hours: null, text: '' };
  const ms = Date.now() - new Date(ts).getTime();
  const hours = ms / 3_600_000;
  const text =
    hours < 1
      ? `${Math.round(ms / 60_000)} min ago`
      : hours < 24
        ? `${hours.toFixed(1)}h ago`
        : `${Math.floor(hours / 24)}d ago`;
  return { hours, text };
}
