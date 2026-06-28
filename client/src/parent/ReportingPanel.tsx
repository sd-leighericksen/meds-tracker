import { useEffect, useState } from 'react';
import {
  api,
  type GroupRow,
  type PrnHistory,
  type ReportDay,
  type ReportSummary,
} from '../api';
import { btn, EmptyHint, ErrorBanner, Input } from '../ui';

function useResetKey() {
  const [key, setKey] = useState(0);
  return { key, bump: () => setKey((k) => k + 1) };
}

type Tab = 'adherence' | 'day' | 'prn';
const TABS: { key: Tab; label: string }[] = [
  { key: 'adherence', label: 'Adherence' },
  { key: 'day',       label: 'Day log' },
  { key: 'prn',       label: 'PRN history' },
];

export function ReportingPanel() {
  const [tab, setTab] = useState<Tab>('adherence');
  const [resetting, setResetting] = useState(false);
  const { key, bump } = useResetKey();

  const handleReset = async () => {
    if (
      !confirm(
        'This will permanently delete all dose logs and reporting data. Are you sure?'
      )
    )
      return;
    setResetting(true);
    try {
      await api.resetReporting();
      bump();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-h3 text-ink">Reporting</h2>
        <button
          className={btn.danger}
          onClick={handleReset}
          disabled={resetting}
        >
          {resetting ? 'Clearing…' : 'Clear all data'}
        </button>
      </div>
      <p className="text-caption text-stone">
        All numbers come from daily logs. Editing config never rewrites them.
        "Clear all data" permanently deletes all logs.
      </p>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                'rounded-full border px-4 py-2 text-button-md ' +
                (active
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === 'adherence' && <Adherence key={key} />}
      {tab === 'day' && <DayLog key={key} />}
      {tab === 'prn' && <PrnHistoryView key={key} />}
    </div>
  );
}

/* ---------------- Adherence ---------------- */

function Adherence() {
  const [window, setWindow] = useState<7 | 30>(7);
  const [data, setData] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSummary({ window })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [window]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span className="text-caption-bold text-slate">Window</span>
        {[7, 30].map((w) => {
          const active = w === window;
          return (
            <button
              key={w}
              onClick={() => setWindow(w as 7 | 30)}
              className={
                'rounded-full border px-4 py-1.5 text-button-md ' +
                (active
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
              }
            >
              {w} days
            </button>
          );
        })}
        {data && (
          <span className="ml-2 text-caption text-stone">
            {data.since} → {data.until}
          </span>
        )}
      </div>
      <ErrorBanner error={error} />
      {data && (
        <>
          <Section title="By person" rows={data.by_person} />
          <Section title="By medication" rows={data.by_medication} />
          <Section title="By routine" rows={data.by_routine} />
        </>
      )}
    </div>
  );
}

function Section({ title, rows }: { title: string; rows: GroupRow[] }) {
  return (
    <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
      <h3 className="text-h4 text-ink mb-4">{title}</h3>
      {rows.length === 0 ? (
        <div className="text-body-sm text-slate">No data in this window.</div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <AdherenceRow key={r.group_id} row={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AdherenceRow({ row }: { row: GroupRow }) {
  const denom = row.scheduled || 0;
  const rate = denom === 0 ? null : Math.round((row.taken_on_time / denom) * 100);
  // Bar segments
  const seg = (n: number) => (denom === 0 ? 0 : (n / denom) * 100);
  return (
    <li className="rounded-xl border border-hairline-soft bg-surface-soft p-4">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-h5 text-ink">{row.group_name}</div>
        <div className="text-caption text-stone">
          {rate === null ? '—' : `${rate}% on time`} · {denom} scheduled
        </div>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface">
        {denom > 0 && (
          <>
            <div
              style={{ width: `${seg(row.taken_on_time)}%` }}
              className="bg-success-accent"
              title={`${row.taken_on_time} on time`}
            />
            <div
              style={{ width: `${seg(row.taken_late)}%` }}
              className="bg-brand-yellow"
              title={`${row.taken_late} late`}
            />
            <div
              style={{ width: `${seg(row.missed)}%` }}
              className="bg-brand-red-dark"
              title={`${row.missed} missed`}
            />
            <div
              style={{ width: `${seg(row.pending)}%` }}
              className="bg-muted"
              title={`${row.pending} pending`}
            />
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-caption">
        <Pill className="bg-teal-light text-moss-dark" label="on time" n={row.taken_on_time} />
        <Pill className="bg-yellow-light text-yellow-dark" label="late" n={row.taken_late} />
        <Pill className="bg-brand-red text-brand-red-dark" label="missed" n={row.missed} />
        <Pill className="bg-coral-light text-coral-dark" label="away" n={row.away} />
        <Pill className="bg-surface text-stone" label="pending" n={row.pending} />
      </div>
    </li>
  );
}

function Pill({ label, n, className }: { label: string; n: number; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${className}`}>
      <span className="font-semibold">{n}</span>
      <span>{label}</span>
    </span>
  );
}

/* ---------------- Day log ---------------- */

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function DayLog() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState<ReportDay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getReportDay(date)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [date]);

  const move = (deltaDays: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + deltaDays);
    setDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <button className={btn.secondary} onClick={() => move(-1)}>
          ← Prev
        </button>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-48"
        />
        <button className={btn.secondary} onClick={() => move(1)} disabled={date >= todayISO()}>
          Next →
        </button>
        <button className={btn.ghost} onClick={() => setDate(todayISO())}>
          Today
        </button>
      </div>
      <ErrorBanner error={error} />
      {data && <DayLogTable data={data} />}
    </div>
  );
}

function DayLogTable({ data }: { data: ReportDay }) {
  if (data.scheduled.length === 0 && data.prn.length === 0) {
    return <EmptyHint>No doses logged on {data.date}.</EmptyHint>;
  }

  // Group scheduled by person.
  const byPerson = new Map<
    number,
    { name: string; rows: ReportDay['scheduled'] }
  >();
  for (const r of data.scheduled) {
    const cur = byPerson.get(r.person_id) ?? { name: r.person_name, rows: [] };
    cur.rows.push(r);
    byPerson.set(r.person_id, cur);
  }

  return (
    <div className="flex flex-col gap-5">
      {[...byPerson.values()].map((p) => (
        <section
          key={p.name}
          className="rounded-3xl border border-hairline-soft bg-canvas p-6"
        >
          <h3 className="text-h4 text-ink">{p.name}</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {p.rows.map((r) => (
              <ScheduledRow key={r.id} row={r} />
            ))}
          </ul>
        </section>
      ))}
      {data.prn.length > 0 && (
        <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
          <h3 className="text-h4 text-ink">PRN doses</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {data.prn.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-md border border-hairline-soft bg-surface-soft p-3"
              >
                <span className="text-body-md text-ink">{r.person_name}</span>
                <span className="text-body-sm text-slate">{r.med_proper_name}</span>
                <span className="ml-auto text-caption text-stone">
                  taken {fmtTime(r.taken_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ScheduledRow({ row }: { row: ReportDay['scheduled'][number] }) {
  const outcome = row.outcome ?? 'pending';
  const tone: Record<string, string> = {
    taken_on_time: 'bg-teal-light text-moss-dark',
    taken_late: 'bg-yellow-light text-yellow-dark',
    missed: 'bg-brand-red text-brand-red-dark',
    away: 'bg-coral-light text-coral-dark',
    pending: 'bg-surface text-stone',
  };
  const label: Record<string, string> = {
    taken_on_time: 'on time',
    taken_late: 'late',
    missed: 'missed',
    away: 'away',
    pending: 'pending',
  };
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-hairline-soft bg-surface-soft p-3">
      <span className={`rounded-full px-2.5 py-0.5 text-caption-bold ${tone[outcome]}`}>
        {label[outcome]}
      </span>
      <span className="text-body-md text-ink">{row.routine_name}</span>
      <span className="text-body-sm text-slate">{row.med_proper_name}</span>
      <span className="text-caption text-steel">
        due {row.due_time}
        {row.dispensed && row.dispensed_at ? ` · dispensed ${fmtTime(row.dispensed_at)}` : ''}
        {row.dispensed_by ? ` by ${row.dispensed_by}` : ''}
        {row.taken && row.taken_at ? ` · taken ${fmtTime(row.taken_at)}` : ''}
      </span>
    </li>
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ---------------- PRN history ---------------- */

function PrnHistoryView() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<PrnHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getPrnHistory(days)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [days]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span className="text-caption-bold text-slate">Window</span>
        {[7, 30, 90].map((w) => {
          const active = w === days;
          return (
            <button
              key={w}
              onClick={() => setDays(w as 7 | 30 | 90)}
              className={
                'rounded-full border px-4 py-1.5 text-button-md ' +
                (active
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
              }
            >
              {w} days
            </button>
          );
        })}
        {data && (
          <span className="ml-2 text-caption text-stone">
            {data.since} → {data.until}
          </span>
        )}
      </div>
      <ErrorBanner error={error} />
      {data && data.groups.length === 0 && (
        <EmptyHint>No PRN doses logged in this window.</EmptyHint>
      )}
      {data && data.groups.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.groups.map((g) => (
            <li
              key={`${g.person_id}-${g.medication_id}`}
              className="rounded-xl border border-hairline-soft bg-canvas p-4 shadow-elev-1"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-h5 text-ink">
                    {g.person_name} · {g.med_proper_name}
                  </div>
                  <div className="text-caption text-slate">
                    {g.med_dose}
                    {g.med_dose_size ? ` · ${g.med_dose_size}` : ''}
                  </div>
                </div>
                <div className="text-right text-body-sm text-ink">
                  <div className="text-h4 text-ink">{g.count}</div>
                  <div className="text-caption text-stone">
                    last {g.last_taken_at ? fmtTime(g.last_taken_at) : '—'}
                  </div>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {g.logs.slice(0, 30).map((l) => (
                  <li
                    key={l.id}
                    className="rounded-full bg-surface px-2.5 py-1 text-caption text-ink"
                    title={l.taken_at}
                  >
                    {l.date.slice(5)} · {fmtTime(l.taken_at)}
                    {l.dispensed_by ? ` · ${l.dispensed_by}` : ''}
                  </li>
                ))}
                {g.logs.length > 30 && (
                  <li className="rounded-full bg-surface px-2.5 py-1 text-caption text-stone">
                    +{g.logs.length - 30} more
                  </li>
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
