/** Optional parent-name prompt after a dispense tap, per the brief's resolved
 *  open item. Always skippable. Drawn from settings.parent_names. */
export function DispenseByPicker({
  names,
  onPick,
  onSkip,
}: {
  names: string[];
  onPick: (name: string) => void;
  onSkip: () => void;
}) {
  return (
    <div
      onClick={onSkip}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-8"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-5 rounded-feature bg-canvas p-8 shadow-elev-4"
      >
        <div>
          <div className="text-micro-uppercase text-steel">Who dispensed?</div>
          <div className="text-h4 text-ink">Optional — skippable</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {names.length === 0 ? (
            <div className="text-body-sm text-slate">
              No parent names yet. Add some in Parent area → Settings.
            </div>
          ) : (
            names.map((n) => (
              <button
                key={n}
                onClick={() => onPick(n)}
                className="rounded-full bg-surface-yellow px-5 py-2 text-button-md text-yellow-dark active:bg-brand-yellow"
              >
                {n}
              </button>
            ))
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={onSkip}
            className="rounded-full bg-surface px-5 py-2 text-button-md text-ink active:bg-hairline"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
