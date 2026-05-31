import { useEffect, useState } from 'react';
import { api, auth, ApiError } from '../api';
import type { Settings } from '../types';
import { btn, ErrorBanner, Field, Input, Toggle } from '../ui';

export function SettingsPanel({ onPinChanged }: { onPinChanged: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    api.getSettings().then(setS).catch((e: Error) => setError(e.message));
  }, []);

  const save = async (patch: Partial<Settings>) => {
    setError(null);
    try {
      const next = await api.updateSettings(patch);
      setS(next);
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!s) return <div className="text-body-md text-slate">Loading…</div>;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-h3 text-ink">Settings</h2>
      <ErrorBanner error={error} />

      <DispenseSection settings={s} onChange={(v) => save(v)} />
      <ParentNamesSection
        names={s.parent_names}
        onChange={(parent_names) => save({ parent_names })}
      />
      <WebhookSection
        url={s.webhook_url}
        onChange={(webhook_url) => save({ webhook_url })}
      />
      <PinChangeSection onChanged={onPinChanged} />
      <MaintenanceSection />

      {savedAt && (
        <div className="text-caption text-stone">
          Last saved {new Date(savedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

function DispenseSection({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
      <h3 className="text-h4 text-ink">Dispense attribution</h3>
      <p className="mt-1 text-body-sm text-slate">
        v1 default: capture <em>when</em> a dose was dispensed, but not <em>who</em>. Turn
        this on to prompt for a parent name after each dispense tap. The prompt is always
        skippable.
      </p>
      <div className="mt-4">
        <Toggle
          checked={settings.dispensed_by_required}
          onChange={(v) => onChange({ dispensed_by_required: v })}
          label={settings.dispensed_by_required ? 'Prompting on' : 'Prompting off'}
        />
      </div>
    </section>
  );
}

function ParentNamesSection({
  names,
  onChange,
}: {
  names: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  return (
    <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
      <h3 className="text-h4 text-ink">Parent names</h3>
      <p className="mt-1 text-body-sm text-slate">
        Used by the dispense-who prompt (when enabled above). Keep it short — one tap
        each.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(names.filter((x) => x !== n))}
            className="inline-flex items-center gap-2 rounded-full bg-surface-yellow px-4 py-1.5 text-caption-bold text-yellow-dark"
          >
            {n}
            <span className="text-stone">✕</span>
          </button>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder='e.g. "Mum"'
          className="max-w-xs"
        />
        <button
          className={btn.secondary}
          onClick={() => {
            const v = draft.trim();
            if (!v) return;
            if (names.includes(v)) {
              setDraft('');
              return;
            }
            onChange([...names, v]);
            setDraft('');
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}

function WebhookSection({
  url,
  onChange,
}: {
  url: string | null;
  onChange: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(url ?? '');
  const [testStatus, setTestStatus] = useState<string | null>(null);
  useEffect(() => setDraft(url ?? ''), [url]);
  const fire = async () => {
    setTestStatus('Sending…');
    try {
      const res = await api.testWebhook();
      setTestStatus(
        res.ok
          ? `Sent to ${res.url}. Check n8n for a webhook.test event.`
          : `Could not send: ${res.error}`
      );
    } catch (e) {
      setTestStatus((e as Error).message);
    }
  };
  return (
    <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
      <h3 className="text-h4 text-ink">n8n webhook</h3>
      <p className="mt-1 text-body-sm text-slate">
        Target URL for <code>dose.due</code>, <code>dose.dispensed</code>,{' '}
        <code>dose.taken</code>, <code>dose.missed</code>, and{' '}
        <code>person.routine_complete</code>. Away suppresses both due and missed.
      </p>
      <div className="mt-4 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://n8n.local/webhook/..."
          className="flex-1"
        />
        <button
          className={btn.secondary}
          onClick={() => onChange(draft.trim() || null)}
        >
          Save
        </button>
        <button className={btn.ghost} onClick={fire} disabled={!url}>
          Test
        </button>
      </div>
      {testStatus && (
        <div className="mt-2 text-caption text-stone">{testStatus}</div>
      )}
    </section>
  );
}

function MaintenanceSection() {
  return (
    <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
      <h3 className="text-h4 text-ink">Backup &amp; maintenance</h3>
      <p className="mt-1 text-body-sm text-slate">
        All household data lives in a single SQLite file. Backup is one file copy;
        restore is putting it back.
      </p>
      <dl className="mt-4 grid grid-cols-1 gap-3 text-body-sm sm:grid-cols-[200px_1fr]">
        <dt className="text-micro-uppercase text-steel">Database file</dt>
        <dd className="font-mono text-ink">
          /data/meds.sqlite{' '}
          <span className="text-stone">
            (host volume mounted into the Docker container)
          </span>
        </dd>
        <dt className="text-micro-uppercase text-steel">Uploaded photos</dt>
        <dd className="font-mono text-ink">/data/uploads/</dd>
        <dt className="text-micro-uppercase text-steel">Backup command</dt>
        <dd className="font-mono text-ink">
          cp /data/meds.sqlite{' '}
          <span className="text-stone">{`/backup/meds-$(date +%F).sqlite`}</span>
        </dd>
        <dt className="text-micro-uppercase text-steel">Restore</dt>
        <dd className="text-ink">
          Stop the container, replace <code>/data/meds.sqlite</code>, start the
          container.
        </dd>
      </dl>
      <p className="mt-4 text-caption text-stone">
        The file is in WAL mode while the app runs — a hot copy is safe, but for an
        atomic snapshot stop the container first.
      </p>
    </section>
  );
}

function PinChangeSection({ onChanged }: { onChanged: () => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const submit = async () => {
    setError(null);
    setOk(false);
    if (!/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirm) {
      setError('PINs do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.setPin(pin);
      auth.setToken(res.token);
      setOk(true);
      setPin('');
      setConfirm('');
      onChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401)
        setError('Session expired — re-enter the current PIN to continue.');
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
      <h3 className="text-h4 text-ink">Change PIN</h3>
      <p className="mt-1 text-body-sm text-slate">
        A single shared 4-digit PIN protects this area. Changing it logs everyone out
        elsewhere.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:max-w-md">
        <Field label="New PIN">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </Field>
        <Field label="Confirm">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className={btn.primary} onClick={submit} disabled={busy}>
          Update PIN
        </button>
        {ok && <span className="text-caption text-success-accent">PIN updated.</span>}
        {error && <span className="text-caption text-brand-red-dark">{error}</span>}
      </div>
    </section>
  );
}
