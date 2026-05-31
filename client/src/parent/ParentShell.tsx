import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, auth, ApiError } from '../api';
import { PinGate } from './PinGate';
import { PeoplePanel } from './PeoplePanel';
import { RoutinesPanel } from './RoutinesPanel';
import { MedicationsPanel } from './MedicationsPanel';
import { ScheduledPanel } from './ScheduledPanel';
import { PrnPanel } from './PrnPanel';
import { AwayPanel } from './AwayPanel';
import { ReportingPanel } from './ReportingPanel';
import { SettingsPanel } from './SettingsPanel';
import { btn } from '../ui';

type Tab =
  | 'people'
  | 'routines'
  | 'medications'
  | 'scheduled'
  | 'prn'
  | 'away'
  | 'reporting'
  | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'people',       label: 'People' },
  { key: 'routines',     label: 'Routines' },
  { key: 'medications',  label: 'Medications' },
  { key: 'scheduled',    label: 'Assignments' },
  { key: 'prn',          label: 'PRN' },
  { key: 'away',         label: 'Away' },
  { key: 'reporting',    label: 'Reporting' },
  { key: 'settings',     label: 'Settings' },
];

export function ParentShell() {
  const [unlocked, setUnlocked] = useState<boolean>(!!auth.getToken());
  const [tab, setTab] = useState<Tab>('people');
  const navigate = useNavigate();

  // If a stale token is present, fail closed on first GET that needs PIN.
  // GETs in this app are unauthenticated, so we instead probe a write to detect.
  // Simpler: trust localStorage; mutating endpoints will re-prompt on 401.

  useEffect(() => {
    if (!auth.getToken()) setUnlocked(false);
  }, []);

  if (!unlocked) {
    return (
      <>
        <BareTopBar />
        <div className="flex-1">
          <PinGate onUnlocked={() => setUnlocked(true)} />
        </div>
      </>
    );
  }

  const lock = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    auth.setToken(null);
    setUnlocked(false);
  };

  // After a PIN change, a fresh token has already been set by SettingsPanel.
  // We just stay unlocked here.

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-hairline-soft bg-canvas px-6 py-3">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-h4 text-brand-yellow">Meds</span>
            <span className="text-h4 text-ink">Tracker</span>
          </Link>
          <span className="text-caption text-stone">Parent area</span>
        </div>
        <div className="flex items-center gap-2">
          <button className={btn.ghost} onClick={() => navigate('/')}>
            Back to grid
          </button>
          <button className={btn.secondary} onClick={lock}>
            Lock
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-hairline-soft bg-surface-soft px-6 py-3">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                'rounded-full border px-4 py-2 text-button-md ' +
                (active
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-hairline-strong bg-canvas text-ink active:bg-surface')
              }
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 overflow-y-auto px-6 py-6">
        <ErrorBoundary onUnauthorized={lock}>
          {tab === 'people'       && <PeoplePanel />}
          {tab === 'routines'     && <RoutinesPanel />}
          {tab === 'medications'  && <MedicationsPanel />}
          {tab === 'scheduled'    && <ScheduledPanel />}
          {tab === 'prn'          && <PrnPanel />}
          {tab === 'away'         && <AwayPanel />}
          {tab === 'reporting'    && <ReportingPanel />}
          {tab === 'settings'     && <SettingsPanel onPinChanged={() => {/* token already refreshed */}} />}
        </ErrorBoundary>
      </main>
    </div>
  );
}

function BareTopBar() {
  return (
    <header className="flex items-center justify-between border-b border-hairline-soft bg-canvas px-6 py-3">
      <Link to="/" className="flex items-baseline gap-2">
        <span className="text-h4 text-brand-yellow">Meds</span>
        <span className="text-h4 text-ink">Tracker</span>
      </Link>
      <span className="text-caption text-stone">Parent area</span>
    </header>
  );
}

// Catch 401s bubbling up from panels and force re-PIN.
function ErrorBoundary({
  children,
  onUnauthorized,
}: {
  children: React.ReactNode;
  onUnauthorized: () => void;
}) {
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      if (e.reason instanceof ApiError && e.reason.status === 401) {
        onUnauthorized();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, [onUnauthorized]);
  return <>{children}</>;
}
