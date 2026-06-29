import { useEffect, useState } from 'react';
import { api, auth, ApiError } from '../api';
import type { AiModel, Settings, SettingsPatch } from '../types';
import { btn, ErrorBanner, Field, Input, Select, Toggle } from '../ui';

export function SettingsPanel({ onPinChanged }: { onPinChanged: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    api.getSettings().then(setS).catch((e: Error) => setError(e.message));
  }, []);

  const save = async (patch: SettingsPatch) => {
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
      <IncomingWebhookSection
        secret={s.incoming_webhook_secret}
        onChange={(incoming_webhook_secret) => save({ incoming_webhook_secret })}
      />
      <AiSection
        enabled={s.ai_enabled}
        keyHint={s.openrouter_api_key_hint}
        defaultModel={s.default_ai_model}
        onSave={(patch) => save(patch)}
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

function IncomingWebhookSection({
  secret,
  onChange,
}: {
  secret: string | null;
  onChange: (v: string | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const endpoint =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/incoming/away`
      : '/api/incoming/away';

  const generate = () => {
    const s =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    onChange(s);
  };

  const copyExample = async () => {
    const example = `curl -X POST ${endpoint} \\
  -H "content-type: application/json" \\
  -H "x-webhook-secret: ${secret ?? 'YOUR_SECRET'}" \\
  -d '{"person": "Mia", "away": true, "note": "With Dad"}'`;
    try {
      await navigator.clipboard.writeText(example);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  };

  return (
    <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
      <h3 className="text-h4 text-ink">Incoming webhook — set a person away</h3>
      <p className="mt-1 text-body-sm text-slate">
        Let an external automation (e.g. n8n, a geofence, a smart-home trigger) flip a
        person to <strong>away</strong> or back <strong>home</strong>. Authenticated by
        the secret below — not the PIN — so it works headlessly.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span
          className={
            'inline-flex items-center rounded-full px-3 py-1 text-caption-bold ' +
            (secret ? 'bg-success-bg text-success-accent' : 'bg-surface text-stone')
          }
        >
          {secret ? 'Secret configured' : 'No secret set'}
        </span>
        <button className={btn.secondary} onClick={generate}>
          {secret ? 'Regenerate secret' : 'Generate secret'}
        </button>
        {secret && (
          <button
            className={btn.ghost}
            onClick={() => {
              if (confirm('Clear the incoming webhook secret? This disables the endpoint.'))
                onChange(null);
            }}
          >
            Clear
          </button>
        )}
      </div>

      {secret && (
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Secret">
            <Input value={secret} readOnly className="font-mono" />
          </Field>
          <div className="rounded-xl border border-hairline-soft bg-surface p-4">
            <div className="text-micro-uppercase text-steel">Endpoint</div>
            <code className="break-all text-body-sm text-ink">POST {endpoint}</code>
            <div className="mt-3 text-micro-uppercase text-steel">Body (JSON)</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-caption text-ink">
{`{
  "person": "Mia",        // or "person_id": 3
  "away": true,           // false = back home (default true)
  "note": "With Dad"      // optional, shown on the grid
}`}
            </pre>
            <p className="mt-2 text-caption text-stone">
              Send the secret as the <code>x-webhook-secret</code> header, a{' '}
              <code>?secret=</code> query param, or a <code>secret</code> body field.
            </p>
            <button className={btn.ghost + ' mt-2'} onClick={copyExample}>
              {copied ? 'Copied ✓' : 'Copy curl example'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AiSection({
  enabled,
  keyHint,
  defaultModel,
  onSave,
}: {
  enabled: boolean;
  keyHint: string | null;
  defaultModel: string;
  onSave: (patch: SettingsPatch) => void | Promise<void>;
}) {
  const [models, setModels] = useState<AiModel[]>([]);
  const [keyDraft, setKeyDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .listAiModels()
      .then((r) => setModels(r.models))
      .catch(() => {});
  }, []);

  const saveKey = async () => {
    const v = keyDraft.trim();
    if (!v) return;
    setBusy(true);
    try {
      await onSave({ openrouter_api_key: v });
      setKeyDraft('');
    } finally {
      setBusy(false);
    }
  };

  const clearKey = async () => {
    if (!confirm('Remove the saved OpenRouter API key?')) return;
    setBusy(true);
    try {
      await onSave({ openrouter_api_key: null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-hairline-soft bg-canvas p-6">
      <h3 className="text-h4 text-ink">AI medication extraction</h3>
      <p className="mt-1 text-body-sm text-slate">
        Photograph the front (and optionally back) of a medication and let an OpenRouter
        vision model fill in the medication, dose, timing, prescribed-to and so on. You
        always review the fields before saving.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span
          className={
            'inline-flex items-center rounded-full px-3 py-1 text-caption-bold ' +
            (enabled
              ? 'bg-success-bg text-success-accent'
              : 'bg-surface text-stone')
          }
        >
          {enabled ? `Key configured (${keyHint ?? '…'})` : 'No key set'}
        </span>
        <a
          href="https://openrouter.ai/keys"
          target="_blank"
          rel="noreferrer"
          className="text-caption text-brand-blue underline"
        >
          Get an OpenRouter key
        </a>
      </div>

      <div className="mt-4 flex max-w-2xl items-end gap-2">
        <Field label={enabled ? 'Replace API key' : 'OpenRouter API key'}>
          <Input
            type="password"
            autoComplete="off"
            value={keyDraft}
            placeholder="sk-or-v1-…"
            onChange={(e) => setKeyDraft(e.target.value)}
          />
        </Field>
        <button
          className={btn.primary}
          onClick={saveKey}
          disabled={busy || !keyDraft.trim()}
        >
          Save key
        </button>
        {enabled && (
          <button className={btn.ghost} onClick={clearKey} disabled={busy}>
            Clear
          </button>
        )}
      </div>
      <p className="mt-2 text-caption text-stone">
        Stored in the SQLite settings table. Never returned by the API after saving — only
        the last 4 characters are echoed back as a hint.
      </p>

      <div className="mt-4 max-w-md">
        <Field label="Default model">
          <Select
            value={defaultModel}
            onChange={(e) => onSave({ default_ai_model: e.target.value })}
            disabled={!enabled || models.length === 0}
          >
            {models.map((m) => (
              <option key={m.slug} value={m.slug}>
                {m.label} — {m.blurb}
              </option>
            ))}
          </Select>
        </Field>
      </div>
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
