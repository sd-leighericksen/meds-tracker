import { useEffect, useState } from 'react';
import { api, auth, ApiError } from '../api';
import { btn } from '../ui';

export function PinGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.authStatus().then((s) => setPinSet(s.pin_set)).catch(() => setPinSet(true));
  }, []);

  const press = (d: string) => {
    setError(null);
    if (d === '⌫') {
      if (pinSet === false && confirm.length < 4 && pin.length === 4) {
        setConfirm((v) => v.slice(0, -1));
      } else {
        setPin((v) => v.slice(0, -1));
      }
      return;
    }
    if (pinSet === false) {
      if (pin.length < 4) {
        setPin((v) => v + d);
        return;
      }
      if (confirm.length < 4) setConfirm((v) => v + d);
      return;
    }
    if (pin.length < 4) setPin((v) => v + d);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (pinSet === false) {
        if (pin !== confirm) {
          setError('PINs do not match.');
          setBusy(false);
          return;
        }
        const { token } = await api.setPin(pin);
        auth.setToken(token);
      } else {
        const { token } = await api.verifyPin(pin);
        auth.setToken(token);
      }
      onUnlocked();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError('Incorrect PIN.');
      else setError((e as Error).message);
      setPin('');
      setConfirm('');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (pinSet === false && pin.length === 4 && confirm.length === 4) void submit();
    if (pinSet === true && pin.length === 4) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, confirm, pinSet]);

  if (pinSet === null) {
    return (
      <div className="flex h-full items-center justify-center text-body-md text-slate">
        Loading…
      </div>
    );
  }

  const active = pinSet ? pin : pin.length < 4 ? pin : confirm;
  const label = pinSet
    ? 'Enter PIN'
    : pin.length < 4
      ? 'Set a 4-digit PIN'
      : 'Confirm the PIN';

  return (
    <div className="flex h-full items-center justify-center bg-canvas p-8">
      <div className="flex w-full max-w-md flex-col items-center gap-8 rounded-3xl border border-hairline-soft bg-canvas p-10 shadow-elev-1">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="text-micro-uppercase text-steel">Parent area</div>
          <div className="text-h3 text-ink">{label}</div>
        </div>
        <div className="flex items-center gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={
                'h-5 w-5 rounded-full ' +
                (i < active.length ? 'bg-primary' : 'border-2 border-hairline-strong')
              }
            />
          ))}
        </div>
        {error && <div className="text-body-sm text-brand-red-dark">{error}</div>}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) => (
            <button
              key={i}
              disabled={d === '' || busy}
              onClick={() => press(d)}
              className={
                d === ''
                  ? 'invisible'
                  : 'h-16 w-20 rounded-full bg-surface text-h4 text-ink active:bg-hairline'
              }
            >
              {d}
            </button>
          ))}
        </div>
        <button
          className={btn.ghost}
          onClick={() => {
            setPin('');
            setConfirm('');
            setError(null);
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
