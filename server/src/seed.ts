// Dev seed. Idempotent-ish: wipes domain tables (not meta/settings/logs) and
// re-inserts a representative household. Safe to run repeatedly in dev.

import { db } from './db.js';

function wipe() {
  // Order matters for FK constraints, even though we use ON DELETE CASCADE.
  db.exec(`
    DELETE FROM prn_dose_logs;
    DELETE FROM scheduled_dose_logs;
    DELETE FROM away_periods;
    DELETE FROM prn_assignments;
    DELETE FROM scheduled_assignments;
    DELETE FROM medications;
    DELETE FROM routines;
    DELETE FROM people;
    DELETE FROM sqlite_sequence
      WHERE name IN ('people','routines','medications','scheduled_assignments',
                     'prn_assignments','away_periods','scheduled_dose_logs','prn_dose_logs');
  `);
}

function seed() {
  const insertPerson = db.prepare(
    `INSERT INTO people (name, image, requires_dispense, sort_order)
     VALUES (@name, @image, @requires_dispense, @sort_order)`
  );
  const insertRoutine = db.prepare(
    `INSERT INTO routines (name, scheduled_time, missed_window_minutes, sort_order)
     VALUES (@name, @scheduled_time, @missed_window_minutes, @sort_order)`
  );
  const insertMed = db.prepare(
    `INSERT INTO medications (proper_name, brand_name, nickname, dose, dose_size,
                              food_timing, notes)
     VALUES (@proper_name, @brand_name, @nickname, @dose, @dose_size,
             @food_timing, @notes)`
  );
  const insertSched = db.prepare(
    `INSERT INTO scheduled_assignments
       (person_id, routine_id, medication_id, dose_override, time_override,
        missed_window_override, start_date, end_date)
     VALUES (@person_id, @routine_id, @medication_id, @dose_override, @time_override,
             @missed_window_override, @start_date, @end_date)`
  );
  const insertPrn = db.prepare(
    `INSERT INTO prn_assignments
       (person_id, medication_id, dose_override, max_per_day, min_interval_hours,
        start_date, end_date)
     VALUES (@person_id, @medication_id, @dose_override, @max_per_day, @min_interval_hours,
             @start_date, @end_date)`
  );

  const tx = db.transaction(() => {
    // People
    const alex = Number(
      insertPerson.run({ name: 'Alex',  image: null, requires_dispense: 0, sort_order: 0 })
        .lastInsertRowid
    );
    const sam = Number(
      insertPerson.run({ name: 'Sam',   image: null, requires_dispense: 0, sort_order: 1 })
        .lastInsertRowid
    );
    const mia = Number(
      insertPerson.run({ name: 'Mia',   image: null, requires_dispense: 1, sort_order: 2 })
        .lastInsertRowid
    );
    const leo = Number(
      insertPerson.run({ name: 'Leo',   image: null, requires_dispense: 1, sort_order: 3 })
        .lastInsertRowid
    );

    // Routines
    const morning = Number(
      insertRoutine.run({ name: 'Morning',      scheduled_time: '07:30', missed_window_minutes: 90,  sort_order: 0 })
        .lastInsertRowid
    );
    const lunch = Number(
      insertRoutine.run({ name: 'Lunch',        scheduled_time: '12:30', missed_window_minutes: 60,  sort_order: 1 })
        .lastInsertRowid
    );
    const afterDinner = Number(
      insertRoutine.run({ name: 'After dinner', scheduled_time: '19:00', missed_window_minutes: 90,  sort_order: 2 })
        .lastInsertRowid
    );
    const bedtime = Number(
      insertRoutine.run({ name: 'Bedtime',      scheduled_time: '20:30', missed_window_minutes: 120, sort_order: 3 })
        .lastInsertRowid
    );

    // Medications
    const vitD = Number(
      insertMed.run({
        proper_name: 'Cholecalciferol', brand_name: 'Ostelin', nickname: 'Vitamin D',
        dose: '1 tablet', dose_size: '1000 IU', food_timing: 'with_food',
        notes: 'Take with breakfast.',
      }).lastInsertRowid
    );
    const iron = Number(
      insertMed.run({
        proper_name: 'Ferrous sulfate', brand_name: 'Ferro-grad', nickname: 'Iron',
        dose: '1 tablet', dose_size: '325 mg', food_timing: 'empty_stomach',
        notes: 'Avoid taking with dairy.',
      }).lastInsertRowid
    );
    const meth = Number(
      insertMed.run({
        proper_name: 'Methylphenidate', brand_name: 'Concerta', nickname: 'ADHD med',
        dose: '1 tablet', dose_size: '27 mg', food_timing: 'with_food',
        notes: 'Do not crush or chew — XR.',
      }).lastInsertRowid
    );
    const melatonin = Number(
      insertMed.run({
        proper_name: 'Melatonin', brand_name: 'Circadin', nickname: 'Sleep tab',
        dose: '1 tablet', dose_size: '2 mg', food_timing: 'none',
        notes: 'Bedtime only.',
      }).lastInsertRowid
    );
    const amox = Number(
      insertMed.run({
        proper_name: 'Amoxicillin', brand_name: 'Amoxil', nickname: 'Pink antibiotic',
        dose: '5 ml', dose_size: '250 mg/5 ml', food_timing: 'none',
        notes: 'Shake well. Finish the course.',
      }).lastInsertRowid
    );
    const paracetamol = Number(
      insertMed.run({
        proper_name: 'Paracetamol', brand_name: 'Panadol', nickname: 'The pink one',
        dose: '2 tablets', dose_size: '500 mg', food_timing: 'none',
        notes: null,
      }).lastInsertRowid
    );
    const ventolin = Number(
      insertMed.run({
        proper_name: 'Salbutamol', brand_name: 'Ventolin', nickname: 'Blue puffer',
        dose: '1–2 puffs', dose_size: '100 mcg/puff', food_timing: 'none',
        notes: 'Shake before use. Rinse mouth after.',
      }).lastInsertRowid
    );

    // Scheduled assignments — ongoing
    insertSched.run({
      person_id: alex, routine_id: morning, medication_id: vitD,
      dose_override: null, time_override: null, missed_window_override: null,
      start_date: null, end_date: null,
    });
    insertSched.run({
      person_id: sam, routine_id: morning, medication_id: vitD,
      dose_override: null, time_override: null, missed_window_override: null,
      start_date: null, end_date: null,
    });
    insertSched.run({
      person_id: sam, routine_id: morning, medication_id: iron,
      dose_override: null, time_override: '07:00', missed_window_override: null,
      start_date: null, end_date: null,
    });
    insertSched.run({
      person_id: mia, routine_id: morning, medication_id: meth,
      dose_override: null, time_override: null, missed_window_override: null,
      start_date: null, end_date: null,
    });
    insertSched.run({
      person_id: leo, routine_id: bedtime, medication_id: melatonin,
      dose_override: null, time_override: null, missed_window_override: 60,
      start_date: null, end_date: null,
    });

    // Scheduled course — a 5-day antibiotic for Mia
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const courseStart = fmt(today);
    const courseEnd = fmt(new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000));
    for (const r of [morning, lunch, afterDinner]) {
      insertSched.run({
        person_id: mia, routine_id: r, medication_id: amox,
        dose_override: null, time_override: null, missed_window_override: null,
        start_date: courseStart, end_date: courseEnd,
      });
    }

    // PRN assignments
    insertPrn.run({
      person_id: alex, medication_id: paracetamol, dose_override: null,
      max_per_day: 8, min_interval_hours: 4, start_date: null, end_date: null,
    });
    insertPrn.run({
      person_id: sam, medication_id: paracetamol, dose_override: null,
      max_per_day: 8, min_interval_hours: 4, start_date: null, end_date: null,
    });
    insertPrn.run({
      person_id: mia, medication_id: ventolin,
      dose_override: '2 puffs',
      max_per_day: 8, min_interval_hours: 4, start_date: null, end_date: null,
    });
    insertPrn.run({
      person_id: leo, medication_id: paracetamol,
      dose_override: '1 tablet',
      max_per_day: 4, min_interval_hours: 6, start_date: null, end_date: null,
    });
  });
  tx();
}

wipe();
seed();

const counts = db
  .prepare(
    `SELECT
       (SELECT COUNT(*) FROM people)                 AS people,
       (SELECT COUNT(*) FROM routines)               AS routines,
       (SELECT COUNT(*) FROM medications)            AS medications,
       (SELECT COUNT(*) FROM scheduled_assignments)  AS scheduled_assignments,
       (SELECT COUNT(*) FROM prn_assignments)        AS prn_assignments`
  )
  .get();

// eslint-disable-next-line no-console
console.log('seed complete:', counts);
