// Schema migrations. Each migration runs once; meta.schema_version tracks progress.
// Stage 1 is one big initial migration; future stages append.

export type Migration = { version: number; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: /* sql */ `
      CREATE TABLE people (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        name                TEXT    NOT NULL,
        image               TEXT,
        requires_dispense   INTEGER NOT NULL DEFAULT 0 CHECK (requires_dispense IN (0,1)),
        sort_order          INTEGER NOT NULL DEFAULT 0,
        created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE routines (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        name                    TEXT    NOT NULL,
        scheduled_time          TEXT    NOT NULL,                      -- HH:MM (24h)
        missed_window_minutes   INTEGER NOT NULL DEFAULT 60 CHECK (missed_window_minutes >= 0),
        colour                  TEXT,                                   -- design token name, optional
        sort_order              INTEGER NOT NULL DEFAULT 0,
        created_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      CREATE TABLE medications (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        proper_name   TEXT    NOT NULL,
        brand_name    TEXT,
        nickname      TEXT,
        dose          TEXT    NOT NULL,                                 -- e.g. "2 tablets"
        dose_size     TEXT,                                              -- e.g. "500 mg"
        photo_box     TEXT,
        photo_tablet  TEXT,
        food_timing   TEXT    NOT NULL DEFAULT 'none'
                              CHECK (food_timing IN ('with_food','before_food','empty_stomach','none')),
        notes         TEXT,
        created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );

      -- Scheduled (ongoing) and scheduled-course assignments. Course = start/end dates populated.
      CREATE TABLE scheduled_assignments (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id                INTEGER NOT NULL REFERENCES people(id)      ON DELETE CASCADE,
        routine_id               INTEGER NOT NULL REFERENCES routines(id)    ON DELETE CASCADE,
        medication_id            INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        dose_override            TEXT,
        time_override            TEXT,                                  -- HH:MM
        missed_window_override   INTEGER CHECK (missed_window_override IS NULL OR missed_window_override >= 0),
        start_date               TEXT,                                  -- YYYY-MM-DD
        end_date                 TEXT,                                  -- YYYY-MM-DD inclusive
        created_at               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_sched_assign_person   ON scheduled_assignments(person_id);
      CREATE INDEX idx_sched_assign_routine  ON scheduled_assignments(routine_id);
      CREATE INDEX idx_sched_assign_med      ON scheduled_assignments(medication_id);

      CREATE TABLE prn_assignments (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id           INTEGER NOT NULL REFERENCES people(id)      ON DELETE CASCADE,
        medication_id       INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        dose_override       TEXT,
        max_per_day         INTEGER NOT NULL CHECK (max_per_day >= 1),
        min_interval_hours  REAL    NOT NULL CHECK (min_interval_hours >= 0),
        start_date          TEXT,
        end_date            TEXT,
        created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_prn_assign_person ON prn_assignments(person_id);
      CREATE INDEX idx_prn_assign_med    ON prn_assignments(medication_id);

      -- Away periods (date range, inclusive on both ends).
      CREATE TABLE away_periods (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        start_date  TEXT    NOT NULL,
        end_date    TEXT    NOT NULL,
        note        TEXT,
        created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_away_person ON away_periods(person_id);
      CREATE INDEX idx_away_dates  ON away_periods(start_date, end_date);

      -- Immutable scheduled-dose log. Frozen copy of details at the time it was generated.
      CREATE TABLE scheduled_dose_logs (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        date                     TEXT    NOT NULL,                     -- YYYY-MM-DD
        person_id                INTEGER NOT NULL,
        routine_id               INTEGER NOT NULL,
        medication_id            INTEGER NOT NULL,
        assignment_id            INTEGER NOT NULL,                     -- source scheduled_assignment

        -- frozen copy at day-generation time
        person_name              TEXT    NOT NULL,
        routine_name             TEXT    NOT NULL,
        med_proper_name          TEXT    NOT NULL,
        med_brand_name           TEXT,
        med_nickname             TEXT,
        med_dose                 TEXT    NOT NULL,
        med_dose_size            TEXT,
        med_food_timing          TEXT    NOT NULL,
        med_photo_box            TEXT,
        med_photo_tablet         TEXT,

        due_time                 TEXT    NOT NULL,                     -- HH:MM resolved for the day
        missed_window_minutes    INTEGER NOT NULL,

        dispensed                INTEGER NOT NULL DEFAULT 0 CHECK (dispensed IN (0,1)),
        dispensed_at             TEXT,
        dispensed_by             TEXT,
        taken                    INTEGER NOT NULL DEFAULT 0 CHECK (taken IN (0,1)),
        taken_at                 TEXT,

        outcome                  TEXT CHECK (outcome IS NULL OR outcome IN ('taken_on_time','taken_late','missed','away')),
        webhook_due_fired        INTEGER NOT NULL DEFAULT 0 CHECK (webhook_due_fired IN (0,1)),
        webhook_missed_fired     INTEGER NOT NULL DEFAULT 0 CHECK (webhook_missed_fired IN (0,1)),

        created_at               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at               TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),

        UNIQUE (date, person_id, routine_id, medication_id, assignment_id)
      );
      CREATE INDEX idx_sched_log_date          ON scheduled_dose_logs(date);
      CREATE INDEX idx_sched_log_date_person   ON scheduled_dose_logs(date, person_id);
      CREATE INDEX idx_sched_log_date_routine  ON scheduled_dose_logs(date, routine_id);

      -- Immutable PRN dose log; each dose taken is one row.
      CREATE TABLE prn_dose_logs (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        date                TEXT    NOT NULL,                          -- YYYY-MM-DD (local day of taken_at)
        person_id           INTEGER NOT NULL,
        medication_id       INTEGER NOT NULL,
        assignment_id       INTEGER NOT NULL,

        person_name         TEXT    NOT NULL,
        med_proper_name     TEXT    NOT NULL,
        med_brand_name      TEXT,
        med_nickname        TEXT,
        med_dose            TEXT    NOT NULL,
        med_dose_size       TEXT,
        med_food_timing     TEXT    NOT NULL,
        med_photo_box       TEXT,
        med_photo_tablet    TEXT,

        dispensed           INTEGER NOT NULL DEFAULT 0 CHECK (dispensed IN (0,1)),
        dispensed_at        TEXT,
        dispensed_by        TEXT,
        taken_at            TEXT    NOT NULL,

        created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX idx_prn_log_date           ON prn_dose_logs(date);
      CREATE INDEX idx_prn_log_date_person    ON prn_dose_logs(date, person_id);
      CREATE INDEX idx_prn_log_person_med     ON prn_dose_logs(person_id, medication_id, taken_at);

      -- App-wide settings (PIN hash, webhook URLs, etc.). One row per key.
      CREATE TABLE settings (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
    `,
  },
  {
    version: 2,
    sql: /* sql */ `
      -- One-shot guard for the optional person.routine_complete webhook.
      CREATE TABLE routine_completions (
        date        TEXT    NOT NULL,
        person_id   INTEGER NOT NULL,
        routine_id  INTEGER NOT NULL,
        fired_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        PRIMARY KEY (date, person_id, routine_id)
      );
    `,
  },
];
