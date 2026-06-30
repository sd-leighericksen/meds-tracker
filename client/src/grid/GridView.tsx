import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Settings } from '../types';
import { btn, MedTitle } from '../ui';
import { deriveCellState, STATE_LOOK, type CellState } from './cellState';
import { DispenseByPicker } from './DispenseByPicker';
import { MedDetailCard, type MedDetail } from './MedDetailCard';
import { PrnPanel } from './PrnPanel';
import type { DayColumn, DayLog, DayPayload, DayPerson } from './types';

// Auto-poll the day every 30s so it stays fresh and surfaces any state shift
// from the per-minute scheduler (Stage 5 will lean on this; harmless before).
const DAY_POLL_MS = 30_000;
const CLOCK_TICK_MS = 30_000;

function todayLocalISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Below Tailwind's `sm` breakpoint (640px) we drop the wide person×med grid for
// a stacked per-person card layout that fits a phone in portrait.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

type PeopleFilter = 'all' | 'adults' | 'children';
type GroupBy = 'person' | 'medication';

export function GridView() {
  const [day, setDay] = useState<DayPayload | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routineId, setRoutineId] = useState<number | null>(null);
  const [manualPick, setManualPick] = useState(false);
  const [detail, setDetail] = useState<MedDetail | null>(null);
  const [pendingDispense, setPendingDispense] = useState<DayLog | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('person');
  const isMobile = useIsMobile();

  const [offline, setOffline] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    setSyncing(true);
    try {
      const d = await api.getDay();
      setDay(d);
      setOffline(false);
      setLastSync(new Date());
      setError(null);
      if (!manualPick) setRoutineId(d.active_routine_id ?? d.routines[0]?.id ?? null);
    } catch (e) {
      setOffline(true);
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [manualPick]);

  useEffect(() => {
    void reload();
    void api.getSettings().then(setSettings).catch(() => undefined);
  }, [reload]);

  // 30s clock — drives in-UI state transitions (pending → due → overdue)
  // without needing a server roundtrip.
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, []);

  // Day poll (background freshness).
  useEffect(() => {
    const t = setInterval(reload, DAY_POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  // On-wake refetch (brief §5: robust rollover, computed on load/wake).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setClock(new Date());
        void reload();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [reload]);

  // Date-change detection: if the locale day rolls past the day returned by
  // the server, force a refetch so we land on the new day's fresh grid.
  useEffect(() => {
    if (!day) return;
    if (todayLocalISO(clock) !== day.date) void reload();
  }, [clock, day, reload]);

  // Real-time sync: subscribe to SSE and reload on any server-side change.
  // The reload is debounced so rapid saves (e.g. settings) only fire once.
  useEffect(() => {
    const reloadRef = { current: reload };
    reloadRef.current = reload;

    const es = new EventSource('/api/events');
    let debounce: ReturnType<typeof setTimeout> | null = null;

    es.addEventListener('change', () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => reloadRef.current(), 300);
    });

    return () => {
      if (debounce) clearTimeout(debounce);
      es.close();
    };
  }, [reload]);

  if (!day) {
    return (
      <div className="flex h-full items-center justify-center text-body-md text-slate">
        {error ?? 'Loading…'}
      </div>
    );
  }

  const filteredPeople = day.people.filter((p) => {
    if (peopleFilter === 'adults') return !p.is_child;
    if (peopleFilter === 'children') return p.is_child;
    return true;
  });

  const empty =
    day.people.length === 0 || day.routines.length === 0 ||
    Object.values(day.columns_by_routine).every((c) => c.length === 0);

  const pickRoutine = (id: number) => {
    setRoutineId(id);
    setManualPick(true);
  };

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      <TopBar date={day.date} clock={clock} offline={offline} lastSync={lastSync} onRefresh={reload} syncing={syncing} />
      {empty ? (
        <EmptyHero />
      ) : (
        <>
          <RoutinePills
            day={day}
            clock={clock}
            activeId={routineId}
            onPick={pickRoutine}
            manual={manualPick}
            onResetAuto={() => {
              setManualPick(false);
              setRoutineId(day.active_routine_id ?? day.routines[0]?.id ?? null);
            }}
            peopleFilter={peopleFilter}
            onPeopleFilter={setPeopleFilter}
            groupBy={groupBy}
            onGroupBy={setGroupBy}
          />
          <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            {isMobile ? (
              <MobileDayList
                day={day}
                clock={clock}
                routineId={routineId}
                people={filteredPeople}
                onOpenDetail={setDetail}
                onAfterTap={reload}
                onAskDispenseBy={(log) => setPendingDispense(log)}
                settings={settings}
                groupBy={groupBy}
              />
            ) : (
              <Grid
                day={day}
                clock={clock}
                routineId={routineId}
                people={filteredPeople}
                onOpenDetail={setDetail}
                onAfterTap={reload}
                onAskDispenseBy={(log) => setPendingDispense(log)}
                settings={settings}
                groupBy={groupBy}
              />
            )}
            <div className="my-8 h-px bg-hairline-soft" />
            <PrnPanel
              settings={settings}
              onAskDispenseBy={() => undefined}
              onOpenDetail={setDetail}
            />
          </main>
        </>
      )}

      {detail && <MedDetailCard med={detail} onClose={() => setDetail(null)} />}

      {pendingDispense && settings?.dispensed_by_required && (
        <DispenseByPicker
          names={settings.parent_names}
          onPick={async (name) => {
            setPendingDispense(null);
            await api.dispense(pendingDispense.id, name);
            void reload();
          }}
          onSkip={() => setPendingDispense(null)}
        />
      )}
    </div>
  );
}

function TopBar({
  date,
  clock,
  offline,
  lastSync,
  onRefresh,
  syncing,
}: {
  date: string;
  clock: Date;
  offline: boolean;
  lastSync: Date | null;
  onRefresh: () => void;
  syncing: boolean;
}) {
  const human = useMemo(
    () =>
      new Date(date + 'T00:00:00').toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [date]
  );
  const hhmm = `${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`;
  return (
    <header className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 border-b border-hairline-soft bg-canvas px-4 py-3 sm:px-6">
      <div className="flex items-baseline gap-2">
        <span className="text-h5 text-brand-yellow sm:text-h4">Meds</span>
        <span className="text-h5 text-ink sm:text-h4">Tracker</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-2 sm:gap-4">
        <span className="hidden text-body-sm text-ink sm:inline sm:text-h5">{human}</span>
        <span className="text-caption text-steel">{hhmm}</span>
        {offline && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-2.5 py-1 text-caption-bold text-brand-red-dark"
            title={lastSync ? `Last sync ${lastSync.toLocaleTimeString('en-AU')}` : 'never synced'}
          >
            <span className="h-2 w-2 rounded-full bg-brand-red-dark" />
            Offline
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={syncing}
          title="Refresh"
          className="flex items-center justify-center rounded-full p-2 text-steel hover:bg-surface active:bg-hairline disabled:opacity-40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={syncing ? 'animate-spin' : ''}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
        <Link to="/parent" className={btn.secondary + ' text-sm px-4 py-2'}>
          Parent area
        </Link>
      </div>
    </header>
  );
}

function RoutinePills({
  day,
  clock,
  activeId,
  onPick,
  manual,
  onResetAuto,
  peopleFilter,
  onPeopleFilter,
  groupBy,
  onGroupBy,
}: {
  day: DayPayload;
  clock: Date;
  activeId: number | null;
  onPick: (id: number) => void;
  manual: boolean;
  onResetAuto: () => void;
  peopleFilter: PeopleFilter;
  onPeopleFilter: (f: PeopleFilter) => void;
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
}) {
  // Routine progress: non-away taken / non-away total across all people.
  const progress = useMemo(() => {
    const m = new Map<number, { taken: number; total: number; missed: number }>();
    for (const r of day.routines) m.set(r.id, { taken: 0, total: 0, missed: 0 });
    for (const byRoutine of Object.entries(day.grid)) {
      const rid = Number(byRoutine[0]);
      const bucket = m.get(rid)!;
      for (const byPerson of Object.values(byRoutine[1])) {
        for (const log of Object.values(byPerson)) {
          if (log.outcome === 'away') continue;
          bucket.total += 1;
          if (log.taken) bucket.taken += 1;
          if (log.outcome === 'missed') bucket.missed += 1;
        }
      }
    }
    return m;
  }, [day]);
  void clock; // included as a dep so the React tree re-renders on tick

  const hasChildren = day.people.some((p) => p.is_child);
  const hasAdults = day.people.some((p) => !p.is_child);
  const showFilter = hasChildren && hasAdults;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-hairline-soft bg-surface-soft px-4 py-3 sm:px-6">
      <div className="flex flex-wrap gap-2">
        {day.routines.map((r) => {
          const active = r.id === activeId;
          const isAutoTarget = r.id === day.active_routine_id;
          const p = progress.get(r.id) ?? { taken: 0, total: 0, missed: 0 };
          const complete = p.total > 0 && p.taken === p.total;
          return (
            <button
              key={r.id}
              onClick={() => onPick(r.id)}
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
              {p.total > 0 && (
                <span
                  className={
                    'rounded-full px-2 text-caption-bold ' +
                    (complete
                      ? 'bg-teal-light text-moss-dark'
                      : p.missed > 0
                        ? 'bg-brand-red text-brand-red-dark'
                        : active
                          ? 'bg-on-primary/20 text-on-primary'
                          : 'bg-surface text-steel')
                  }
                >
                  {p.taken}/{p.total}
                </span>
              )}
              {isAutoTarget && !active && (
                <span className="rounded-full bg-yellow-light px-2 text-caption-bold text-yellow-dark">
                  now
                </span>
              )}
            </button>
          );
        })}
      </div>
      {manual && (
        <button onClick={onResetAuto} className={btn.ghost}>
          Auto-pick
        </button>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {(['person', 'medication'] as GroupBy[]).map((g) => (
            <button
              key={g}
              onClick={() => onGroupBy(g)}
              className={
                'rounded-full border px-3 py-1.5 text-caption-bold ' +
                (g === groupBy
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
              }
            >
              {g === 'person' ? 'By person' : 'By med'}
            </button>
          ))}
        </div>
        {showFilter && (
          <div className="flex items-center gap-1.5">
            {(['all', 'adults', 'children'] as PeopleFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => onPeopleFilter(f)}
                className={
                  'rounded-full border px-3 py-1.5 text-caption-bold capitalize ' +
                  (f === peopleFilter
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-canvas text-ink border-hairline-strong active:bg-surface')
                }
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="flex max-w-xl flex-col items-start gap-4 rounded-3xl border border-hairline-soft bg-canvas p-10 shadow-elev-1">
        <div className="text-h2 text-ink">Nothing scheduled yet.</div>
        <p className="text-body-md text-slate">
          Head into the parent area to add people, routines, medications and assignments.
          The grid lights up as soon as anyone has a dose scheduled for today.
        </p>
        <Link to="/parent" className={btn.primary}>
          Open parent area
        </Link>
      </div>
    </div>
  );
}

/* ---------------- the grid itself ---------------- */

function Grid({
  day,
  clock,
  routineId,
  people,
  onOpenDetail,
  onAfterTap,
  onAskDispenseBy,
  settings,
  groupBy,
}: {
  day: DayPayload;
  clock: Date;
  routineId: number | null;
  people: DayPerson[];
  onOpenDetail: (m: MedDetail) => void;
  onAfterTap: () => void;
  onAskDispenseBy: (l: DayLog) => void;
  settings: Settings | null;
  groupBy: GroupBy;
}) {
  if (routineId === null) return null;
  const cols = day.columns_by_routine[routineId] ?? [];
  const routine = day.routines.find((r) => r.id === routineId);

  // Only show people who have assignments in this routine.
  const shownPeople = people.filter(
    (p) => Object.keys(day.grid[routineId]?.[p.id] ?? {}).length > 0
  );

  if (cols.length === 0) {
    return (
      <div className="rounded-3xl border border-hairline-soft bg-canvas p-10 text-center text-body-md text-slate">
        No medications scheduled for <strong>{routine?.name}</strong> today.
      </div>
    );
  }

  const colWidth = 'minmax(220px, 1fr)';

  if (groupBy === 'medication') {
    const gridStyle = {
      display: 'grid',
      gridTemplateColumns: `200px repeat(${shownPeople.length}, ${colWidth})`,
    };
    return (
      <div className="overflow-x-auto pb-2">
        <div style={gridStyle} className="min-w-fit gap-x-4 gap-y-3">
          <div className="sticky left-0 z-10 bg-canvas" />
          {shownPeople.map((p) => (
            <PersonHeaderCell key={p.id} person={p} />
          ))}
          {cols.map((c) => (
            <MedRow
              key={c.medication_id}
              col={c}
              people={shownPeople}
              day={day}
              clock={clock}
              routineId={routineId}
              onOpenDetail={onOpenDetail}
              onAfterTap={onAfterTap}
              onAskDispenseBy={onAskDispenseBy}
              settings={settings}
            />
          ))}
        </div>
      </div>
    );
  }

  // groupBy === 'person'
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `200px repeat(${cols.length}, ${colWidth})`,
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div style={gridStyle} className="min-w-fit gap-x-4 gap-y-3">
        {/* header row */}
        <div className="sticky left-0 z-10 bg-canvas" />
        {cols.map((c) => (
          <HeaderCell key={c.medication_id} col={c} onOpen={() => onOpenDetail(toDetail(c))} />
        ))}
        {/* body rows */}
        {shownPeople.map((p) => (
          <PersonRow
            key={p.id}
            person={p}
            cols={cols}
            day={day}
            clock={clock}
            routineId={routineId}
            onAfterTap={onAfterTap}
            onAskDispenseBy={onAskDispenseBy}
            settings={settings}
          />
        ))}
      </div>
    </div>
  );
}

function HeaderCell({ col, onOpen }: { col: DayColumn; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex flex-col items-start gap-1 rounded-xl bg-surface-soft p-3 text-left active:bg-surface"
    >
      <div className="text-caption text-stone">{col.due_time}</div>
      <MedTitle nickname={col.med_nickname} properName={col.med_proper_name} />
      <div className="text-caption text-slate">
        {col.med_dose}
        {col.med_dose_size ? ` · ${col.med_dose_size}` : ''}
      </div>
    </button>
  );
}

function PersonHeaderCell({ person }: { person: DayPerson }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface-soft p-3">
      <Avatar src={person.image} name={person.name} away={person.away} />
      <div className="flex flex-col">
        <div className="text-body-sm text-ink">{person.name}</div>
        <div className="text-caption text-stone">
          {person.away ? (
            <span className="text-coral-dark">
              Away{person.away_note ? ` · ${person.away_note}` : ''}
            </span>
          ) : person.requires_dispense ? (
            'Dispense + Taken'
          ) : (
            'Taken only'
          )}
        </div>
      </div>
    </div>
  );
}

function MedRow({
  col,
  people,
  day,
  clock,
  routineId,
  onOpenDetail,
  onAfterTap,
  onAskDispenseBy,
  settings,
}: {
  col: DayColumn;
  people: DayPerson[];
  day: DayPayload;
  clock: Date;
  routineId: number;
  onOpenDetail: (m: MedDetail) => void;
  onAfterTap: () => void;
  onAskDispenseBy: (l: DayLog) => void;
  settings: Settings | null;
}) {
  return (
    <>
      <button
        onClick={() => onOpenDetail(toDetail(col))}
        className="sticky left-0 flex flex-col items-start gap-1 rounded-xl bg-canvas p-3 text-left active:bg-surface"
      >
        <div className="text-caption text-stone">{col.due_time}</div>
        <MedTitle nickname={col.med_nickname} properName={col.med_proper_name} />
        <div className="text-caption text-slate">
          {col.med_dose}
          {col.med_dose_size ? ` · ${col.med_dose_size}` : ''}
        </div>
      </button>
      {people.map((p) => {
        const log = day.grid[routineId]?.[p.id]?.[col.medication_id] ?? null;
        return (
          <Cell
            key={p.id}
            person={p}
            log={log}
            state={log ? deriveCellState(log, clock) : null}
            onAfterTap={onAfterTap}
            onAskDispenseBy={onAskDispenseBy}
            promptOnDispense={!!settings?.dispensed_by_required && settings.parent_names.length > 0}
          />
        );
      })}
    </>
  );
}

function toDetail(c: DayColumn): MedDetail {
  return {
    proper_name: c.med_proper_name,
    brand_name: c.med_brand_name,
    nickname: c.med_nickname,
    dose: c.med_dose,
    dose_size: c.med_dose_size,
    food_timing: c.med_food_timing,
    photo_box: c.med_photo_box,
    photo_tablet: c.med_photo_tablet,
    due_time: c.due_time,
  };
}

/* ---------------- mobile: stacked per-person cards ---------------- */

function MobileDayList({
  day,
  clock,
  routineId,
  people,
  onOpenDetail,
  onAfterTap,
  onAskDispenseBy,
  settings,
  groupBy,
}: {
  day: DayPayload;
  clock: Date;
  routineId: number | null;
  people: DayPerson[];
  onOpenDetail: (m: MedDetail) => void;
  onAfterTap: () => void;
  onAskDispenseBy: (l: DayLog) => void;
  settings: Settings | null;
  groupBy: GroupBy;
}) {
  if (routineId === null) return null;
  const cols = day.columns_by_routine[routineId] ?? [];
  const routine = day.routines.find((r) => r.id === routineId);

  // Only show people who actually have something in this routine.
  const shown = people.filter(
    (p) => Object.keys(day.grid[routineId]?.[p.id] ?? {}).length > 0
  );

  if (cols.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline-soft bg-canvas p-8 text-center text-body-md text-slate">
        No medications scheduled for <strong>{routine?.name}</strong> today.
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline-soft bg-canvas p-8 text-center text-body-md text-slate">
        No one in this view has medications for <strong>{routine?.name}</strong>{' '}
        today.
      </div>
    );
  }

  if (groupBy === 'medication') {
    return (
      <div className="flex flex-col gap-4">
        {cols.map((c) => (
          <MobileMedCard
            key={c.medication_id}
            col={c}
            people={shown}
            day={day}
            clock={clock}
            routineId={routineId}
            onOpenDetail={onOpenDetail}
            onAfterTap={onAfterTap}
            onAskDispenseBy={onAskDispenseBy}
            settings={settings}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {shown.map((p) => (
        <MobilePersonCard
          key={p.id}
          person={p}
          day={day}
          clock={clock}
          routineId={routineId}
          cols={cols}
          onOpenDetail={onOpenDetail}
          onAfterTap={onAfterTap}
          onAskDispenseBy={onAskDispenseBy}
          settings={settings}
        />
      ))}
    </div>
  );
}

function MobileMedCard({
  col,
  people,
  day,
  clock,
  routineId,
  onOpenDetail,
  onAfterTap,
  onAskDispenseBy,
  settings,
}: {
  col: DayColumn;
  people: DayPerson[];
  day: DayPayload;
  clock: Date;
  routineId: number;
  onOpenDetail: (m: MedDetail) => void;
  onAfterTap: () => void;
  onAskDispenseBy: (l: DayLog) => void;
  settings: Settings | null;
}) {
  const promptOnDispense =
    !!settings?.dispensed_by_required && settings.parent_names.length > 0;

  const peopleWithMed = people.filter(
    (p) => day.grid[routineId]?.[p.id]?.[col.medication_id]
  );

  if (peopleWithMed.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <button
        onClick={() => onOpenDetail(toDetail(col))}
        className="flex items-start justify-between gap-2 text-left active:opacity-70"
      >
        <div className="flex flex-col gap-0.5">
          <MedTitle nickname={col.med_nickname} properName={col.med_proper_name} />
          <div className="text-caption text-slate">
            {col.med_dose}
            {col.med_dose_size ? ` · ${col.med_dose_size}` : ''}
          </div>
        </div>
        <div className="shrink-0 text-caption text-stone">{col.due_time}</div>
      </button>
      <div className="flex flex-col gap-2">
        {peopleWithMed.map((p) => {
          const log = day.grid[routineId]![p.id]![col.medication_id]!;
          const state = deriveCellState(log, clock);
          const look = STATE_LOOK[state];
          if (state === 'away') {
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-hairline-soft bg-surface p-3"
              >
                <Avatar src={p.image} name={p.name} away={p.away} />
                <span className="text-body-sm text-coral-dark">
                  {p.name} · Away{p.away_note ? ` · ${p.away_note}` : ''}
                </span>
              </div>
            );
          }
          return (
            <div key={p.id} className={'flex flex-col gap-2 rounded-xl border p-3 ' + look.container}>
              <div className="flex items-center gap-2">
                <Avatar src={p.image} name={p.name} away={p.away} />
                <span className="text-body-sm text-ink">{p.name}</span>
                {look.badge && (
                  <span
                    className={
                      'ml-auto shrink-0 rounded-full px-2 py-0.5 text-caption-bold ' +
                      look.badge.cls
                    }
                  >
                    {look.badge.label}
                  </span>
                )}
              </div>
              <div className="flex items-stretch gap-2">
                {p.requires_dispense && (
                  <CheckboxButton
                    label="Dispensed"
                    checked={log.dispensed === 1}
                    onTap={() =>
                      toggleDispense(log, promptOnDispense, onAskDispenseBy, onAfterTap)
                    }
                    sub={dispensedSub(log)}
                  />
                )}
                <CheckboxButton
                  label="Taken"
                  checked={log.taken === 1}
                  onTap={() => toggleTaken(log, onAfterTap)}
                  sub={takenSub(log, state)}
                  emphasis
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobilePersonCard({
  person,
  day,
  clock,
  routineId,
  cols,
  onOpenDetail,
  onAfterTap,
  onAskDispenseBy,
  settings,
}: {
  person: DayPerson;
  day: DayPayload;
  clock: Date;
  routineId: number;
  cols: DayColumn[];
  onOpenDetail: (m: MedDetail) => void;
  onAfterTap: () => void;
  onAskDispenseBy: (l: DayLog) => void;
  settings: Settings | null;
}) {
  const personLogs = day.grid[routineId]?.[person.id] ?? {};
  const meds = cols.filter((c) => personLogs[c.medication_id]);
  const promptOnDispense =
    !!settings?.dispensed_by_required && settings.parent_names.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline-soft bg-canvas p-4 shadow-elev-1">
      <div className="flex items-center gap-3">
        <Avatar src={person.image} name={person.name} away={person.away} />
        <div className="flex flex-col">
          <div className="text-h5 text-ink">{person.name}</div>
          <div className="text-caption text-stone">
            {person.away ? (
              <span className="text-coral-dark">
                Away{person.away_note ? ` · ${person.away_note}` : ''}
              </span>
            ) : person.requires_dispense ? (
              'Dispense + Taken'
            ) : (
              'Taken only'
            )}
          </div>
        </div>
      </div>
      {person.away ? null : (
        <div className="flex flex-col gap-2">
          {meds.map((c) => {
            const log = personLogs[c.medication_id]!;
            return (
              <MobileMedRow
                key={c.medication_id}
                person={person}
                col={c}
                log={log}
                state={deriveCellState(log, clock)}
                onOpenDetail={onOpenDetail}
                onAfterTap={onAfterTap}
                onAskDispenseBy={onAskDispenseBy}
                promptOnDispense={promptOnDispense}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function MobileMedRow({
  person,
  col,
  log,
  state,
  onOpenDetail,
  onAfterTap,
  onAskDispenseBy,
  promptOnDispense,
}: {
  person: DayPerson;
  col: DayColumn;
  log: DayLog;
  state: CellState;
  onOpenDetail: (m: MedDetail) => void;
  onAfterTap: () => void;
  onAskDispenseBy: (l: DayLog) => void;
  promptOnDispense: boolean;
}) {
  const look = STATE_LOOK[state];
  return (
    <div className={'flex flex-col gap-2 rounded-xl border p-3 ' + look.container}>
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onOpenDetail(toDetail(col))}
          className="flex flex-col items-start text-left active:opacity-70"
        >
          <div className="text-caption text-stone">{col.due_time}</div>
          <MedTitle nickname={col.med_nickname} properName={col.med_proper_name} />
          <div className="text-caption text-slate">
            {col.med_dose}
            {col.med_dose_size ? ` · ${col.med_dose_size}` : ''}
          </div>
        </button>
        {look.badge && (
          <span
            className={
              'shrink-0 rounded-full px-2 py-0.5 text-caption-bold ' + look.badge.cls
            }
          >
            {look.badge.label}
          </span>
        )}
      </div>
      <div className="flex items-stretch gap-2">
        {person.requires_dispense && (
          <CheckboxButton
            label="Dispensed"
            checked={log.dispensed === 1}
            onTap={() =>
              toggleDispense(log, promptOnDispense, onAskDispenseBy, onAfterTap)
            }
            sub={dispensedSub(log)}
          />
        )}
        <CheckboxButton
          label="Taken"
          checked={log.taken === 1}
          onTap={() => toggleTaken(log, onAfterTap)}
          sub={takenSub(log, state)}
          emphasis
        />
      </div>
    </div>
  );
}

function PersonRow({
  person,
  cols,
  day,
  clock,
  routineId,
  onAfterTap,
  onAskDispenseBy,
  settings,
}: {
  person: DayPerson;
  cols: DayColumn[];
  day: DayPayload;
  clock: Date;
  routineId: number;
  onAfterTap: () => void;
  onAskDispenseBy: (l: DayLog) => void;
  settings: Settings | null;
}) {
  const personLogs = day.grid[routineId]?.[person.id] ?? {};
  return (
    <>
      <div className="sticky left-0 flex items-center gap-3 rounded-xl bg-canvas p-3">
        <Avatar src={person.image} name={person.name} away={person.away} />
        <div className="flex flex-col">
          <div className="text-h5 text-ink">{person.name}</div>
          <div className="text-caption text-stone">
            {person.away ? (
              <span className="text-coral-dark">Away{person.away_note ? ` · ${person.away_note}` : ''}</span>
            ) : person.requires_dispense ? (
              'Dispense + Taken'
            ) : (
              'Taken only'
            )}
          </div>
        </div>
      </div>
      {cols.map((c) => {
        const log = personLogs[c.medication_id] ?? null;
        return (
          <Cell
            key={c.medication_id}
            person={person}
            log={log}
            state={log ? deriveCellState(log, clock) : null}
            onAfterTap={onAfterTap}
            onAskDispenseBy={onAskDispenseBy}
            promptOnDispense={!!settings?.dispensed_by_required && settings.parent_names.length > 0}
          />
        );
      })}
    </>
  );
}

function Avatar({ src, name, away }: { src: string | null; name: string; away: boolean }) {
  const inner = src ? (
    <img src={src} alt={name} className="h-12 w-12 rounded-full object-cover" />
  ) : (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-light text-h5 text-yellow-dark">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
  if (!away) return inner;
  return <div className="relative opacity-60 grayscale">{inner}</div>;
}

// Shared tap handlers so the desktop grid cell and the mobile med row drive
// dispense / take identically.
async function toggleDispense(
  log: DayLog,
  promptOnDispense: boolean,
  onAskDispenseBy: (l: DayLog) => void,
  onAfterTap: () => void
) {
  if (log.dispensed === 1) await api.undispense(log.id);
  else if (promptOnDispense) {
    await api.dispense(log.id, null);
    onAskDispenseBy({
      ...log,
      dispensed: 1,
      dispensed_at: new Date().toISOString(),
    });
  } else {
    await api.dispense(log.id, null);
  }
  onAfterTap();
}

async function toggleTaken(log: DayLog, onAfterTap: () => void) {
  if (log.taken === 1) await api.untake(log.id);
  else await api.take(log.id);
  onAfterTap();
}

function takenSub(log: DayLog, state: CellState): string | null {
  if (log.taken === 1 && log.taken_at)
    return new Date(log.taken_at).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  if (state === 'overdue') return `due ${log.due_time}`;
  if (state === 'due') return 'due now';
  return null;
}

function dispensedSub(log: DayLog): string | null {
  if (log.dispensed === 1 && log.dispensed_by) return `by ${log.dispensed_by}`;
  if (log.dispensed === 1) return 'tap to clear';
  return null;
}

function Cell({
  person,
  log,
  state,
  onAfterTap,
  onAskDispenseBy,
  promptOnDispense,
}: {
  person: DayPerson;
  log: DayLog | null;
  state: CellState | null;
  onAfterTap: () => void;
  onAskDispenseBy: (l: DayLog) => void;
  promptOnDispense: boolean;
}) {
  // No medication assigned here today.
  if (!log || !state) {
    return (
      <div className="rounded-xl border border-dashed border-hairline-soft bg-surface-soft p-3 text-caption text-stone">
        —
      </div>
    );
  }
  if (state === 'away') {
    return (
      <div className="rounded-xl border border-hairline-soft bg-surface p-3 text-caption text-coral-dark">
        Away
      </div>
    );
  }

  const look = STATE_LOOK[state];

  // Missed cells: still tappable per brief §5 ("a late dose must always remain
  // recordable"). Tapping Taken on a missed row stamps taken_late.
  return (
    <div
      className={
        'flex flex-col gap-2 rounded-xl border p-3 transition-colors ' + look.container
      }
    >
      {look.badge && (
        <span
          className={
            'self-start rounded-full px-2 py-0.5 text-caption-bold ' + look.badge.cls
          }
        >
          {look.badge.label}
        </span>
      )}
      <div className="flex items-stretch gap-2">
        {person.requires_dispense && (
          <CheckboxButton
            label="Dispensed"
            checked={log.dispensed === 1}
            onTap={() =>
              toggleDispense(log, promptOnDispense, onAskDispenseBy, onAfterTap)
            }
            sub={dispensedSub(log)}
          />
        )}
        <CheckboxButton
          label="Taken"
          checked={log.taken === 1}
          onTap={() => toggleTaken(log, onAfterTap)}
          sub={takenSub(log, state)}
          emphasis
        />
      </div>
    </div>
  );
}

function CheckboxButton({
  label,
  checked,
  onTap,
  sub,
  emphasis,
}: {
  label: string;
  checked: boolean;
  onTap: () => void;
  sub?: string | null;
  emphasis?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  return (
    <button
      ref={ref}
      onClick={async () => {
        if (busy.current) return;
        busy.current = true;
        try {
          await onTap();
        } finally {
          busy.current = false;
        }
      }}
      className={
        'flex flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-3 text-caption-bold ' +
        (checked
          ? emphasis
            ? 'bg-success-accent text-on-primary'
            : 'bg-primary text-on-primary'
          : 'bg-surface text-ink active:bg-hairline')
      }
    >
      <span className="flex items-center gap-2">
        <span
          className={
            'inline-flex h-5 w-5 items-center justify-center rounded-md border-2 ' +
            (checked
              ? 'bg-on-primary text-ink border-on-primary'
              : 'border-hairline-strong bg-canvas')
          }
        >
          {checked ? '✓' : ''}
        </span>
        {label}
      </span>
      {sub && (
        <span className={'text-caption ' + (checked ? 'text-on-dark-muted' : 'text-stone')}>
          {sub}
        </span>
      )}
    </button>
  );
}
