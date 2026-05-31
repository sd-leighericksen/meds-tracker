# meds-tracker

Household medication grid. Touch-first, landscape-locked, runs on a wall-mounted
tablet driven by Docker on Ubuntu. See [BRIEF.md](BRIEF.md) and
[DESIGN.md](DESIGN.md) for the source of truth.

## Stack

- React + Vite + TypeScript + Tailwind (client)
- Fastify + TypeScript + better-sqlite3 (server)
- SQLite, one file on a mounted volume
- npm workspaces in a single repo

## Stage 0 — Project scaffold

Stage 0 brings up a hello-world front end talking to a hello-world API endpoint
backed by a real SQLite file on a mounted volume, locked to landscape, styled
against the Nimbus tokens from `DESIGN.md`.

### Local dev (two processes)

```bash
npm install
npm run dev
```

This starts:

- the API on `http://localhost:3000` (Fastify + better-sqlite3)
- the Vite dev server on `http://localhost:5173`, proxying `/api/*` to 3000

Open `http://localhost:5173` and you should see "Hello, household." with a card
showing the live `/api/hello` response (env, db creation timestamp, server time).

The SQLite file lives at `./data/meds.sqlite` (auto-created on first run).

### Production / Docker

```bash
docker compose up --build
```

The single container builds both client and server, serves the built client
from Fastify, and persists SQLite to the `./data` host directory. Open
`http://localhost:3000`.

### Layout

```
.
├── client/        Vite + React + Tailwind front end
├── server/        Fastify + SQLite back end
├── data/          SQLite volume (gitignored)
├── Dockerfile
├── docker-compose.yml
├── BRIEF.md       Project brief — the contract
└── DESIGN.md      Nimbus visual language — the contract
```

### Backup

A backup is one file: copy `./data/meds.sqlite` somewhere safe.

## Stage 1 — Data model & API foundation

Schema migrations live in [server/src/schema.ts](server/src/schema.ts) and run
automatically on server / seed start, gated by `meta.schema_version`. Tables:
`people`, `routines`, `medications`, `scheduled_assignments` (covers ongoing +
course via nullable `start_date`/`end_date`), `prn_assignments`, `away_periods`,
the immutable `scheduled_dose_logs` and `prn_dose_logs` (each carries a frozen
copy of the medication, routine and person details at generation time), and a
generic key/value `settings` table for the PIN, webhook URLs, etc.

### CRUD endpoints (Stage 1)

| Resource     | Verbs                                        |
| ------------ | -------------------------------------------- |
| `/api/people`      | `GET` list, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `/api/routines`    | `GET` list, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `/api/medications` | `GET` list, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id` |

All write endpoints validate the body with JSON Schema (Fastify built-in).
Times use `HH:MM` (24h), dates `YYYY-MM-DD`. `food_timing` is one of
`with_food | before_food | empty_stomach | none`.

### Seed sample data

```bash
npm run seed
```

Wipes the domain tables and loads a representative household (4 people,
4 routines, 7 meds, 8 scheduled assignments incl. a 5-day antibiotic course,
4 PRN assignments). Safe to re-run.

## Stage 2 — Parent settings view

Lives at `/parent`. On first visit you set the 4-digit PIN; thereafter you enter
it on a number-pad. The PIN is bcrypt-hashed in the `settings` table. Sessions
are in-memory, 30-minute sliding TTL, lost on restart by design.

### Parent UI

Pill-tab navigation across:
- **People** — name, photo upload, `requires_dispense` toggle.
- **Routines** — name, time (`HH:MM`), missed-window minutes.
- **Medications** — proper / brand / nickname, dose, dose size, food timing,
  notes, box and tablet photo uploads.
- **Assignments** — per-routine view. Pick a routine pill, see assignments
  grouped by person. New-assignment flow supports multi-select people for
  shared meds. Dose / time / missed-window overrides and optional course dates.
- **PRN** — `max_per_day`, `min_interval_hours` (memory aid only — never
  blocks), optional course dates.
- **Away** — set a person away for a date range. Doses will log as `away` and
  suppress the missed webhook (wired in Stage 5).
- **Settings** — `dispensed_by` open item: **default OFF**. When on, a parent
  prompt appears after each dispense tap, drawn from an editable parent-name
  list. The PIN can be changed here. The n8n webhook URL is captured here for
  Stage 5.

### Backend additions

- `POST /api/auth/pin/set`, `POST /api/auth/pin/verify`, `POST /api/auth/logout`,
  `GET /api/auth/status` ([server/src/auth.ts](server/src/auth.ts)).
- `requirePin` Fastify hook on every mutating endpoint — `GET`s stay public so
  the grid view can run unauthenticated.
- New CRUD: `/api/scheduled-assignments`, `/api/prn-assignments`,
  `/api/away-periods`, `/api/settings`.
- `POST /api/uploads?kind=person|med-box|med-tablet` (multipart, 5 MB cap,
  jpeg/png/webp/gif) → stores under `data/uploads/`, served at `/uploads/*`.

## Stage 3 — The grid (main view)

Lives at `/`. People (with photo / initial) run down the left, the active
routine's medications run across the top. The currently active routine is
auto-picked as the latest `scheduled_time <= now`, with a manual override
that exposes a "Auto-pick" reset.

### Cells

- Per cell: two checkboxes (Dispensed → Taken) when the person's
  `requires_dispense` is on, otherwise one (Taken).
- Both boxes are freely tappable **and un-tappable** — mis-taps are expected
  (brief §6). No locking. Late taps still work.
- Cells are reserved exclusively for the checkboxes. Tapping the
  **column header** opens the medication detail card (box photo, tablet photo,
  dose, dose size, food timing, notes). Tap outside the card or the Done pill
  to close it.
- Away rows render with a dimmed/grayscale avatar and an "Away" tile in place
  of the cells. Their `scheduled_dose_logs` are stamped `outcome='away'` at
  generation, so they will not fire missed webhooks in Stage 5.

### PRN

Below the grid, grouped by person. Each PRN row shows dose,
`taken_today / max_per_day`, and a soft "last dose Xh ago" note. When inside
`min_interval_hours` the note turns red — but the **+ Dose** button never
blocks (brief §10). Single tap logs one dose; if the person `requires_dispense`
the log goes in with `dispensed=1`. "Undo last" removes the most recent dose
for mis-tap correction.

### Dispense attribution prompt

When **Settings → Dispense attribution** is on and at least one parent name is
configured, the parent picker appears after each dispense tap (on both the
grid and PRN). It is always skippable.

### Day resolution & log immutability

`GET /api/day` calls `ensureDayLogs(date)` first. This idempotently inserts a
`scheduled_dose_log` row for every current scheduled assignment whose date
window covers the day, freezing the relevant person / routine / medication
fields at generation. Away people get their rows stamped `outcome='away'`
at generation. Configuration changes only affect future days (brief §4).

### Tap endpoints (all public — the grid is unauthenticated)

- `POST /api/scheduled-dose-logs/:id/dispense`  body `{ by: string | null }`
- `POST /api/scheduled-dose-logs/:id/undispense`
- `POST /api/scheduled-dose-logs/:id/take`
- `POST /api/scheduled-dose-logs/:id/untake`
- `GET  /api/prn-today` — per-person PRN summary with `taken_today`,
  `last_taken_at`, today's logs
- `POST /api/prn-dose-logs`  body `{ assignment_id, dispensed?, dispensed_by? }`
- `DELETE /api/prn-dose-logs/:id`

## Stage 4 — Daily lifecycle

### States

A scheduled dose has one of: `pending → due → overdue` (transient, derived
client-side from the local clock), or a stamped `outcome` of `taken_on_time`,
`taken_late`, `missed`, or `away`. There is **no lock state** — late doses are
always recordable (brief §5).

### Server: outcome + reconciliation

- [lifecycle.ts](server/src/lifecycle.ts) — `computeTakenOutcome()` uses
  local-clock arithmetic against `due_time + missed_window_minutes`.
  `reconcile()` finalises any stale prior-day row: untaken → `missed`,
  taken-with-null-outcome → `taken_on_time / taken_late`. Idempotent.
- Take / untake now stamp `outcome` inline. Untake clears it.
- `reconcile()` runs at the top of every `GET /api/day`, so on-load and on-wake
  naturally bring the state back to truth (brief §5: "computed on load/wake,
  not by relying on a job firing exactly at 00:00"). Stage 5 will also call it
  from the per-minute scheduler.
- Away rows are never modified by reconcile — their `outcome` stays `away`.

### Client: derived state, ticking clock, robust rollover

- A 30-second clock state drives `pending → due → overdue` transitions in the
  UI without a roundtrip. `Page Visibility` / `focus` listeners refetch
  `/api/day` on wake. A date-rollover check refetches as soon as the local
  date moves past the day returned by the server.
- Per-state styling on cells: pending (canvas), due (yellow-light border with
  "Due now" pill), overdue (brand-red tint + "Overdue" pill), taken-on-time
  (teal-light), taken-late (teal-light + "Late" pill), missed (brand-red tint
  + "Missed" pill), away (surface + dim avatar). Missed cells remain tappable
  — a late tap stamps `taken_late`.

## Stage 5 — Scheduler & webhooks

A per-minute in-process scheduler ([scheduler.ts](server/src/scheduler.ts))
fires events into n8n via the configured `settings.webhook_url`. Each event
arrives as a single JSON envelope:

```jsonc
{
  "event": "dose.due",
  "event_id": "<uuid>",
  "fired_at": "<ISO>",
  "date": "YYYY-MM-DD",
  "payload": { "person": {...}, "routine": {...}, "medication": {...}, "log": {...} }
}
```

### Events

| Event | Trigger | Source |
|---|---|---|
| `dose.due` | scheduler — local time crosses `due_time` | per-minute tick |
| `dose.dispensed` | parent tapped Dispensed | tap handler |
| `dose.taken` | parent / household tapped Taken (scheduled or PRN) | tap handler / PRN create |
| `dose.missed` | scheduler — `due_time + missed_window` elapsed and not taken | per-minute tick |
| `person.routine_complete` | a scheduled take just completed every non-away dose for (date, person, routine) | tap handler |
| `webhook.test` | Settings → Test button | manual |

### Guarantees

- **Each `dose.due` / `dose.missed` fires once per row** — guarded by
  `webhook_due_fired` / `webhook_missed_fired` flags on `scheduled_dose_logs`.
- **`person.routine_complete` fires at most once per (date, person, routine)**
  — guarded by a row in `routine_completions` (migration v2).
- **Away suppresses both `dose.due` and `dose.missed`** for that person (brief
  §9 + the recommended-default open item).
- **Fire-and-forget POST** with a 10s timeout; failures are logged, not retried,
  and never block the API response.
- **`reconcile()` runs at the top of every `GET /api/day` and every tick**, so
  on-wake after a long sleep the right state is rebuilt before any webhook is
  emitted.

### Endpoints

- `POST /api/webhooks/test` — fires a `webhook.test` event to the configured
  URL. PIN-gated.
- `POST /api/webhooks/tick` — manual scheduler kick for dev / on-wake. PIN-gated.

## Stage 6 — Reporting

Reads only the immutable `scheduled_dose_logs` and `prn_dose_logs` —
configuration changes never rewrite history (brief §4 & §8). Lives inside the
PIN-protected parent area under a new **Reporting** tab.

### Endpoints (all PIN-gated)

- `GET /api/reporting/summary?window=7|30`
  - Returns three aggregations over the window: `by_person`, `by_medication`,
    `by_routine`. Each row carries `taken_on_time`, `taken_late`, `missed`,
    `away`, `pending`, plus `scheduled` (non-away total — the brief's
    adherence denominator) and `total`.
- `GET /api/reporting/day?date=YYYY-MM-DD`
  - Full household day log: every scheduled dose with frozen person / routine /
    medication, plus every PRN dose, with dispensed / taken timestamps and
    outcome.
- `GET /api/reporting/prn-history?days=7|30|90`
  - PRN dose events grouped by (person, medication) with `count`,
    `last_taken_at` and the underlying log list.

### UI

- **Adherence:** window pill (7 / 30 days), three stacked sections, each row
  carries a stacked-bar visualisation (on-time / late / missed / pending) and
  a pill row with the absolute counts.
- **Day log:** ← Prev / → Next / Today + a date picker; grouped by person,
  with PRN doses shown at the bottom. Outcome tag on every row.
- **PRN history:** window pill (7 / 30 / 90), one card per (person × med) with
  count, last-taken time, and chips for each individual dose (capped at 30
  visible per group, "+N more" overflow).

## Stage 7 — Polish & hardening

### Edge cases & bug fixes

- **Server-side validation** of `start_date <= end_date` on
  `scheduled_assignments` and `prn_assignments` (create and patch).
- **Webhook idempotency** — `dose.dispensed` now fires only on the 0→1
  transition. Re-tapping with attribution (e.g. supplying the parent name via
  the picker) updates `dispensed_by` in place without a second webhook.
- **PRN attribution** — new `PATCH /api/prn-dose-logs/:id` for setting
  `dispensed_by` after the fact. The parent-name picker uses this rather than
  the previous delete-and-recreate, which had been double-firing
  `dose.taken`.
- **Course transitions** verified: a course starting tomorrow does not appear
  on today's grid; a course ending yesterday does not appear on today's grid.
- **Away ranges** spanning rollover stamp `outcome='away'` on both today's
  and tomorrow's generated rows, with no `dose.due` / `dose.missed` fired.

### Grid polish

- **Offline indicator** — when `/api/day` fetches fail, a red pill appears in
  the top bar (tooltip shows the last-sync time). Clears on the next
  successful fetch.
- **Per-routine progress chip** — each routine pill shows `taken / total`
  (excluding away), turns teal when complete, red when any dose is `missed`.
  Makes Stage 5's `person.routine_complete` visible at a glance.

### Operations

- **Backup & maintenance** section in Settings documents the file paths and
  the one-line backup command. SQLite is in WAL mode while the app runs;
  for an atomic snapshot, stop the container first.

```bash
# hot copy (safe while running)
cp ./data/meds.sqlite /backup/meds-$(date +%F).sqlite

# atomic snapshot
docker compose stop
cp ./data/meds.sqlite /backup/meds-$(date +%F).sqlite
docker compose start
```

- **Restore** = stop the container, drop the backed-up file at
  `./data/meds.sqlite`, start the container. The Stage 1 migrations re-apply
  cleanly on top of any schema version `<= current`.
