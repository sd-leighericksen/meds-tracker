# Project Brief — Household Medication Grid

## 1. Overview

A touch-first web app for tracking the daily medications of everyone in a household. A person (or a parent on their behalf) taps a cell on a grid to record a dose as **dispensed** and/or **taken**. A PIN-protected parent area handles all configuration, and a reporting view tracks adherence and history down to every day, routine, and medication. Webhooks fire into n8n on key events, most importantly when doses fall due and when they are missed.

This is **not** a weekly pill chart and it is **not** a medical or clinical tool. It is a fresh, repeating routine that resets every day. Every routine each day starts a clean slate.

Critically: the app **tracks and reminds**. It does not check drug interactions, validate that a dose is correct or safe, or make any clinical judgement. It must never present information in a way that implies clinical validation. See section 10 (Non-goals).

The app runs locally on a single wall-mounted touch-screen tablet driven by an Ubuntu machine, deployed via Docker.

## 2. Target environment

- **Device:** 10" touch screen, **landscape only**. The UI must be locked to landscape and sized for finger taps. No mobile-portrait layout, no desktop-mouse assumptions.
- **Users:** a mix of **adults and children**. Children typically have a parent dispense for them and tap "taken" themselves; adults self-manage. The dispensing step is enabled **per person**, not by a blanket rule.
- **Host:** Ubuntu machine running Docker. Single client for now, but the API must not assume single-client (don't paint us into a corner if a second screen appears later).
- **Network:** Local LAN only. No public exposure required.

## 3. Architecture

- **Front end:** React + Tailwind CSS, landscape-locked, touch-optimised.
- **Back end:** A single Node service (Fastify or Express) exposing a REST/JSON API over the LAN.
- **Database:** SQLite (single file). No separate DB server.
- **Scheduler:** An in-process scheduler in the Node service running a **per-minute** check for due and missed events.
- **Deployment:** Dockerised, runs on the Ubuntu host. SQLite file lives on a mounted volume so it survives container rebuilds and can be backed up by copying one file.
- **Design source of truth:** A `design.md` file in the project root defines the visual language (colours, typography, spacing, component look). All front-end styling decisions defer to `design.md`.

### Why this stack
The reasoning that held for the routine tracker holds even more strongly here: a household's worth of people, a handful of routines, one device is a tiny dataset on a single client. SQLite removes an always-on DB server (and its failure modes) while keeping every feature, and backup is one file copy. The Node service exists primarily because the due and missed events, and their webhooks, must fire reliably **even when nobody is looking at the screen** — a pure front end can't do that.

## 4. Core concepts and data model

### Entities

**Person** (replaces the routine tracker's "Child")
- `id`
- `name`
- `image` (uploaded photo / avatar)
- `requires_dispense` (bool) — when true, the cell shows both a **dispensed** and a **taken** checkbox; when false, only **taken**. Set per person (e.g. on for kids, off for adults).

**Medication**
- `id`
- `proper_name` — the generic/active name (e.g. Paracetamol)
- `brand_name` — the branded name (e.g. Panadol)
- `nickname` — household shorthand (e.g. "the pink one")
- `dose` — the amount taken per administration, in units (e.g. "2 tablets", "5 ml", "1 puff")
- `dose_size` — the strength per unit (e.g. "500 mg", "5 mg/ml")
- `photo_box` — uploaded photo of the packaging
- `photo_tablet` — uploaded photo of the tablet/medication itself
- `food_timing` — one of: `with_food` | `before_food` | `empty_stomach` | `none`
- `notes` — free text (e.g. "shake well", "do not crush")

`dose` and `dose_size` are deliberately separate: `dose` is how much is taken in one go, `dose_size` is the strength of each unit. A medication's default `dose` can be overridden per assignment (see below), because the same drug may be taken at different amounts in different routines.

**Routine** (replaces "Time block") — **unlimited**
- `id`
- `name` (e.g. "Morning", "Lunch", "Evening", "After dinner")
- `scheduled_time` (time of day the routine's doses are due, e.g. 08:00)
- `missed_window` (minutes after `scheduled_time` before a dose is treated as missed and the missed webhook fires)
- optional visual identity (colour) — see open items in `design.md`

Routines are created and timed at will. There is no fixed morning/afternoon constraint.

### Three kinds of medication assignment

**1. Scheduled (ongoing)** — assigned per person, per routine, with no end date. The everyday case.

**2. Scheduled course (finite)** — same as scheduled, but with a `start_date` and `end_date` (or duration in days). The 5-day antibiotic case. The dose appears on the grid only within its course window and disappears afterwards. Past logs are untouched.

**3. As-needed (PRN)** — **not** tied to a routine. Take when needed, within limits. The painkiller / antihistamine / inhaler case.

### Assignment record (scheduled and scheduled-course)

The relation that links a medication to a person within a routine, mirroring the routine tracker's per-child-per-block assignment:
- `id`
- `person_id`
- `routine_id`
- `medication_id`
- `dose_override` (nullable — defaults to the medication's `dose`)
- `time_override` (nullable — a per-medication `scheduled_time`, overriding the routine's, when a specific med needs a different time within the same routine)
- `missed_window_override` (nullable — a per-medication missed window, overriding the routine's)
- `start_date`, `end_date` (nullable for ongoing; populated for a course)

Setup flow within a routine, same pattern as the routine tracker:
1. Select which people are in that routine.
2. Select existing medications or create new ones.
3. Build the relations — assign specific medications to specific people. Medications can be **shared** (same med assigned to several people) or **individual**.

### PRN assignment record (as-needed)

- `id`
- `person_id`
- `medication_id`
- `dose_override` (nullable)
- `max_per_day` (cap on doses in a calendar day)
- `min_interval_hours` (minimum gap between doses)
- `start_date`, `end_date` (nullable)

`min_interval_hours` powers a soft reminder, not a clinical assertion (see Non-goals). When someone logs a PRN dose inside the interval, the UI says "a dose was logged X ago" — it warns, it does not block, and it does not claim anything about safety.

### Per-person away state

- A person can be set **away** for a date or a date range (handles part-time kids across two households).
- On away days, that person's scheduled doses are logged as **away**, not missed, and **suppress the missed webhook**.

### Daily completion logs (immutable)

Same principle as the routine tracker: **logs are immutable snapshots**. They capture what was assigned *that day*, with a frozen copy of the medication details, and record dispensing/taking. Editing configuration only affects **future** days. It never rewrites past logs or recalculates historical adherence.

Scheduled dose log record (conceptual):
- `id`
- `date`
- `person_id`
- `routine_id`
- `medication_id` (plus frozen copy of name/dose/dose_size/emoji-or-photo refs at the time)
- `dispensed` (bool), `dispensed_at` (timestamp, nullable)
- `dispensed_by` — optional attribution; **open item** (see below)
- `taken` (bool), `taken_at` (timestamp, nullable)
- `due_time` (the resolved due time for that day, after any override)
- `outcome` at day finalisation: `taken_on_time` | `taken_late` | `missed` | `away`

PRN dose log record (conceptual):
- `id`
- `date`
- `person_id`
- `medication_id` (plus frozen copy)
- `taken_at` (timestamp) — each logged dose is its own record
- `dispensed` / `dispensed_at` if the person `requires_dispense`

> **Open item — dispensed attribution.** Capturing *who* dispensed adds genuine audit value, but the routine tracker was deliberately login-free and we don't want to force logins on a wall tablet. Recommended default for v1: capture `dispensed_at` but leave `dispensed_by` optional (e.g. a quick parent-name tap on the dispense action, skippable). Confirm during Stage 2.

## 5. Daily lifecycle

There is **no locking.** A late dose must always remain recordable — the point of the app is an honest record, and a locked grid would force a true late dose into a false "missed".

- **Scheduled dose states** through a day: `pending` → (at `due_time`) `due` → (after `missed_window`) `overdue` → finalises overnight as `missed` if never taken. At any point it can be marked **taken**: before the missed window it logs `taken_on_time`; after it, `taken_late`. Overdue doses are styled distinctly but stay fully tappable.
- **Away** overrides the above for the days a person is away: doses log as `away`, no missed webhook.
- **Day rollover** is just the day boundary that generates the fresh grid. There is no per-routine lock event.
- **Robust rollover:** "what day is it and what should today look like" is computed **on load/wake**, not by relying on a job firing exactly at 00:00. If the tablet is asleep or offline overnight, it resolves the correct day's grid when it wakes. The per-minute scheduler handles due/missed events while the app is running; the same checks reconcile on wake so nothing is silently skipped.

## 6. Front-end behaviour

### The grid (main / person-facing view)
- People's **names (and photos) run down the left**, top to bottom.
- **Medications run across the top**, scoped to the currently shown routine.
- The currently active routine is shown, **auto-selected by current time with a manual override**.
- Each cell at a person × medication intersection shows checkboxes:
  - **two boxes** (dispensed, then taken) where the person `requires_dispense`;
  - **one box** (taken) where they don't.
- Both boxes are freely tappable **and un-tappable** — mis-taps are expected and correctable. No locking.
- **Medication detail card (firm requirement):** a **single tap on the medication name / column header** opens a detail card showing the box photo, tablet photo, dose, dose size, food timing, and notes; tap to dismiss. This is the primary verification aid for "is this the right one". The trigger **must be the medication header, not the cell** — the cell's taps are reserved exclusively for the dispensed/taken checkboxes, so a tap meant to mark a dose can never open the card and vice versa. No long-press, no nested menus. The card's look is defined in `design.md`.
- **Overdue** doses render in a defined attention state (defined in `design.md`) but remain interactive.
- **Away** people render in a defined away state for the day.
- **No celebration.** Completing a routine triggers no confetti, sound, or GIF. (An optional webhook can still notify a caregiver — see section 9.)

### As-needed (PRN) panel
- A separate area, not tied to the active routine, listing each person's PRN medications.
- Tap to log a dose. Shows doses-remaining against `max_per_day` and, if inside `min_interval_hours`, a soft "last dose was X ago" notice. It warns; it never blocks.

## 7. Parent / settings view

- Protected by a **single shared 4-digit PIN**.
- Capabilities:
  - **People:** add/edit/remove — name, image, and the `requires_dispense` toggle.
  - **Routines:** add/edit/remove — name, scheduled time, missed window. Unlimited routines.
  - **Medications:** add/edit/remove — proper name, brand name, nickname, dose, dose size, photo of box, photo of tablet, food timing, notes.
  - **Assignment (scheduled):** within a routine, select people and assign medications (shared or individual), with optional per-assignment dose, time, and missed-window overrides, and optional course start/end dates.
  - **Assignment (PRN):** assign as-needed medications to people with `max_per_day`, `min_interval_hours`, and optional course dates.
  - **Away:** set a person away for a date or range.
  - **Reporting** (see below) lives in here for v1.
- Config changes apply to **future days only**.

## 8. Reporting (v1 scope)

Lives inside the PIN-protected parent area. Reads straight off the immutable logs. Full coverage across **every day, routine, and medication.**

- **Per person:** adherence rate (`taken_on_time` ÷ scheduled, with late and missed broken out) over rolling **7-day** and **30-day** windows; count of late, missed, and away.
- **Per medication:** the same adherence breakdown for a chosen medication across whoever takes it.
- **Per routine:** adherence for a chosen routine.
- **Per day (household day log):** a scrollable, day-by-day view of who was due what, with dispensed/taken/missed/away status and timestamps.
- **PRN history:** dose events per medication per person — how many, and when — so usage of as-needed meds is visible.

`away` days are reported as away, never counted as missed, so the numbers stay honest.

## 9. Webhooks (n8n)

Fired from the Node service into n8n. Webhook target URL(s) configurable via env/config. Each payload carries enough context to be useful (person, medication, routine where relevant, dose, due time, timestamp, date, outcome, away flag).

| Event | When it fires |
|---|---|
| `dose.due` | A routine's `scheduled_time` (or a medication's `time_override`) is reached, per the per-minute scheduler |
| `dose.dispensed` | A dose cell is marked dispensed |
| `dose.taken` | A dose is marked taken (scheduled or PRN) |
| `dose.missed` | A dose's `missed_window` elapses after due with the dose not taken **and** the person not away |
| `person.routine_complete` | (Optional) A person has taken all assigned doses in a routine — useful for a caregiver "all done" notification, no UI effect |

**Away interaction:** away days suppress `dose.missed` for that person. Recommended (open item, confirm in Stage 5): also suppress `dose.due` for away people, since firing a reminder for someone who isn't there is noise. The default brief assumption is to suppress both for away people.

## 10. Non-goals (deliberately out of scope)

Stated as loudly as the routine tracker excluded leaderboards, because the boundary is the point.

- **Not a clinical tool.** No drug-interaction checking, no dose-appropriateness validation, no clinical judgement of any kind. The app must never imply a dose is correct, safe, or approved. It records and reminds.
- **No inventory / stock / refill tracking.** Medications move between households and this device is used in only one of them, so any count would be wrong and misleading. There is intentionally no tablet countdown and no "running low" webhook.
- **No celebration / reward mechanics.** No confetti, sound, GIFs, points, streaks-as-games, or sibling comparison.
- **The PRN `min_interval_hours` guard is a memory aid, not a safety control.** It surfaces "a dose was logged recently" and never blocks an action or asserts anything about safety.

---

## Build stages

Build one stage at a time. Each stage should be runnable / verifiable before moving to the next.

### Stage 0 — Project scaffold
- Set up the repo: React + Tailwind front end, Node (Fastify/Express) back end, SQLite, Docker config.
- Read and honour `design.md` for all styling.
- Landscape-lock the front end and establish the base layout shell.
- Get a "hello world" front end talking to a "hello world" API endpoint, running in Docker against a SQLite file on a mounted volume.

### Stage 1 — Data model & API foundation
- Define the SQLite schema: people, routines, medications, scheduled assignments (incl. course dates and overrides), PRN assignments, per-person away records, and the immutable daily logs (scheduled + PRN).
- Build CRUD API endpoints for people, routines, and medications (no UI yet beyond what's needed to test).
- Seed with sample data for development.

### Stage 2 — Parent settings view (config)
- PIN gate (single shared 4-digit PIN).
- People CRUD (name, image, `requires_dispense`).
- Routines CRUD (name, scheduled time, missed window).
- Medications CRUD (proper/brand/nickname, dose, dose size, box photo, tablet photo, food timing, notes).
- Scheduled assignment flow: select people in a routine, assign medications (shared or individual), per-assignment dose/time/missed-window overrides, course start/end.
- PRN assignment flow: max per day, min interval, course dates.
- Away: set a person away for a date or range.
- Resolve the `dispensed_by` open item here.

### Stage 3 — The grid (main view)
- Render the active routine: people (name + photo) down the left, medications across the top.
- Per cell, show two checkboxes (dispensed + taken) or one (taken), driven by `requires_dispense`.
- Tap to mark; tap again to un-mark. No locking.
- Medication detail card: single tap on the medication header opens photos (box + tablet) and metadata for verification; trigger is the header, never the cell.
- PRN panel: log a dose, show remaining vs `max_per_day`, soft interval notice.
- Auto-select active routine by current time, with manual override.
- Persist all actions to the daily log.

### Stage 4 — Daily lifecycle
- Implement scheduled-dose states (pending / due / overdue / taken_on_time / taken_late / missed / away). No lock state.
- Overdue styling; away styling.
- On-load/wake day resolution (robust rollover) so the correct day's fresh grid appears and missed reconciliation isn't skipped after sleep.
- Overnight finalisation of untaken doses to `missed` (or `away`).

### Stage 5 — Scheduler & webhooks
- Per-minute scheduler in the Node service.
- Wire the events into n8n: `dose.due`, `dose.dispensed`, `dose.taken`, `dose.missed`, and optional `person.routine_complete`, with configurable target URL(s).
- Implement away suppression (missed, and due per the open item).

### Stage 6 — Reporting
- Per-person, per-medication, per-routine adherence with on-time / late / missed / away breakdowns over 7- and 30-day windows.
- Household day-by-day log.
- PRN dose history.
- All read from immutable logs, surfaced inside the parent area.

### Stage 7 — Polish & hardening
- Edge cases: mis-tap handling, offline/wake behaviour, course start/end transitions, away ranges spanning rollover, empty states.
- Final design pass against `design.md`.
- Backup note: document that backing up = copying the SQLite file.
