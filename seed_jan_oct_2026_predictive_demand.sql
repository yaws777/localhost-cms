-- SUPERSEDED by seed_jan2025_oct2026_dispensing.sql (new dispense-limit / dispense-unit model).
-- Do not run this file on a migrated database: it records quantities in the strength unit (mg).
-- =====================================================================================
-- Seed script: Jan-Oct 2026 clinic visits + medicine dispensation + monthly stock
-- snapshots, for exercising the "Predictive Medicine Demand" chart on the nurse
-- dashboard (frontend/src/pages/nurse/nurseDashboard.jsx,
-- backend /api/predictive-medicine in backend/src/database/connection.js).
--
-- Run against the local `ClinicManagementSystem` database (see AGENTS.md).
-- Safe to re-run: step 1 clears its own target window first, and the snapshot
-- insert uses ON DUPLICATE KEY UPDATE.
--
-- NOTE: this version avoids WITH / CTE syntax entirely (plain derived-table
-- subqueries instead). MySQL Workbench's client-side statement splitter was
-- mis-parsing the WITH-clause version of this script and sending only the
-- trailing SELECT to the server, causing "table 'xxx' doesn't exist" errors
-- for CTE names. Plain subqueries sidestep that splitter bug.
--
-- WHAT THIS DOES
--   1. Deletes any existing clinic_visits / consultation_dispensation rows dated
--      2026-01-01..2026-10-31 (2025 rows and anything outside that window are left
--      untouched).
--   2. Backdates the 13 existing medicine_inventory_batches rows' created_at into
--      January 2026 (they were Sep 17-Oct 17, 2026), so medicines read as having
--      existed for the whole Jan-Oct forecast window.
--   3. Inserts exactly 2 clinic_visits per student per month (62 students x 10
--      months x 2 = 1,240 visits), each pair using two DIFFERENT complaint_ids
--      (deterministic hash-based selection, collision-proof by construction).
--   4. Inserts exactly 1 consultation_dispensation per generated visit (1,240
--      rows), picking a medicine indicated for that visit's complaint (falling
--      back to a reasonable default for the 6 complaints with no
--      medicine_indications row), with quantity "1 or 2" expressed in that
--      medicine's own strength_unit_of_measure (see note below).
--   5. Inserts medicine_monthly_stock_snapshots for all 14 medicines x 10 months
--      (140 rows), each oscillating around a baseline chosen so that, once you
--      flip through the month picker, some months show the medicine
--      well-stocked (stock > average demand) and others short (stock < average
--      demand) -- i.e. "sometimes higher, sometimes lower than the snapshot".
--   6. Creates a medicine_inventory_batches row for each of the 3 medicines
--      that had none (Ethyl Alcohol, Bethadine, Paracetamol/Bioflu), via
--      INSERT IGNORE on fixed batch_id values, so the script stays re-runnable.
--
-- IMPORTANT CAVEATS (read before running)
--   - /api/predictive-medicine always computes "average monthly demand" from
--     Jan 1 - Sep 30, 2026 (getAverageDateWindow(), relative to TODAY, not to
--     whichever month you pick in the UI). October's dispensation data is
--     generated as requested and will show up in visit logs / other dashboard
--     widgets, but it does NOT feed into that average. Only the per-month
--     STOCK side (medicine_monthly_stock_snapshots) changes what you see when
--     you flip the picker across Jan-Oct.
--   - All 14 medicines now have at least one medicine_inventory_batches row
--     (step 0 below adds the 3 that were missing one) and all 14 are wired
--     into the complaint -> medicine dispensing map in step 4, so all of them
--     show simulated demand, not just a flat stock line.
--   - Quantity semantics: "dispense qty around 1, sometimes 2" is implemented
--     as (1 or 2) x that medicine's strength_unit_value, recorded in its
--     strength_unit_of_measure. This is what makes the predictive endpoint's
--     math (avgMonthlyBaseDispensed / containerStrengthBase) come out as
--     "1 or 2 tablets/patches/bottles equivalent" rather than a near-zero
--     fraction. It means e.g. Dolfenal (500mg/tablet) dispensation rows will
--     show "500.00" or "1000.00 mg" rather than literally "1"/"2" -- that
--     500/1000 IS the 1-2 tablet quantity, just expressed in mg like the
--     medicine's own strength field.
-- =====================================================================================

-- MySQL Workbench's "safe update mode" blocks the multi-table DELETE in step 1
-- below (it only checks WHERE for a key column, not JOIN ... ON). Disable it for
-- this session; SQL_SAFE_UPDATES is a session-scoped setting, so this doesn't
-- change anything outside this script run.
SET SQL_SAFE_UPDATES = 0;

START TRANSACTION;

-- ---------------------------------------------------------------------------
-- STEP 1: Clear existing Jan-Oct 2026 clinic_visits / consultation_dispensation
-- (2025 data and anything else is untouched)
-- ---------------------------------------------------------------------------
DELETE cd FROM consultation_dispensation cd
JOIN clinic_visits cv ON cv.visit_id = cd.visit_id
WHERE cv.visit_date BETWEEN '2026-01-01' AND '2026-10-31';

DELETE FROM clinic_visits
WHERE visit_date BETWEEN '2026-01-01' AND '2026-10-31';

-- ---------------------------------------------------------------------------
-- STEP 1.5: Create inventory batches for the 3 medicines that have none yet
-- (Ethyl Alcohol, Bethadine, Paracetamol/Bioflu), so every medicine can be
-- referenced by consultation_dispensation. INSERT IGNORE on fixed batch_id
-- values keeps this safe to re-run.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO medicine_inventory_batches
  (batch_id, medicine_id, expiration_date, current_stock, remaining_volume, created_at)
VALUES
  ('9f1e4a3c-5b2d-4e71-8a90-1c2d3e4f5061', '142851d9-6ad0-4d6a-ae89-970db9000746', '2028-01-15', 15, 10.00, '2026-01-05 08:00:00'), -- Ethyl Alcohol
  ('2d7c8b1a-6e4f-4a93-b1c5-7f8e9d0a1b2c', '4d3b9c42-a916-43c6-90f6-0d8ad06aac52', '2027-11-20', 18, 10.00, '2026-01-08 08:00:00'), -- Bethadine
  ('5a6b7c8d-9e0f-4123-8456-789abc0def12', 'e87d25d1-7480-4bf2-9f07-7d429fddfed1', '2028-02-10', 20, 1.00, '2026-01-12 08:00:00');  -- Paracetamol (Bioflu)

-- ---------------------------------------------------------------------------
-- STEP 2: Backdate ALL medicine_inventory_batches (including the ones just
-- inserted above) to January 2026
-- ---------------------------------------------------------------------------
UPDATE medicine_inventory_batches
SET created_at = DATE_ADD('2026-01-01 08:00:00', INTERVAL (CRC32(batch_id) % 20) DAY);

-- ---------------------------------------------------------------------------
-- STEP 3: Generate clinic_visits (2 per student per month, Jan-Oct 2026,
-- each pair using two different complaint_ids)
-- ---------------------------------------------------------------------------
INSERT INTO clinic_visits
  (visit_id, student_id, nurse_id, complaint_id, specify_complaint_text, visit_date,
   time_in, time_out, temperature, respiratory_rate, pulse_rate, blood_pressure,
   nursing_intervention, assessment)
SELECT
  CONCAT('VSEED-', LPAD(ROW_NUMBER() OVER (ORDER BY sl.student_id, sl.month_num, sl.visit_num), 5, '0')) AS visit_id,
  sl.student_id,
  n.nurse_id,
  (CASE WHEN sl.visit_num = 1 THEN cr1.complaint_id ELSE cr2.complaint_id END) AS complaint_id,
  NULL AS specify_complaint_text,
  STR_TO_DATE(
    CONCAT('2026-', LPAD(sl.month_num, 2, '0'), '-', LPAD(1 + (CRC32(CONCAT(sl.seed_key, '-day')) % 27), 2, '0')),
    '%Y-%m-%d'
  ) AS visit_date,
  SEC_TO_TIME((480 + (CRC32(CONCAT(sl.seed_key, '-time')) % 420)) * 60) AS time_in,
  ADDTIME(SEC_TO_TIME((480 + (CRC32(CONCAT(sl.seed_key, '-time')) % 420)) * 60), '00:15:00') AS time_out,
  ROUND(36.0 + (CRC32(CONCAT(sl.seed_key, '-temp')) % 15) / 10, 1) AS temperature,
  16 + (CRC32(CONCAT(sl.seed_key, '-resp')) % 6) AS respiratory_rate,
  65 + (CRC32(CONCAT(sl.seed_key, '-pulse')) % 26) AS pulse_rate,
  CONCAT(105 + (CRC32(CONCAT(sl.seed_key, '-sys')) % 26), '/', 65 + (CRC32(CONCAT(sl.seed_key, '-dia')) % 21)) AS blood_pressure,
  'Administered medication and advised rest.' AS nursing_intervention,
  'Stable; follow-up as needed.' AS assessment
FROM (
  SELECT
    s.student_id,
    mo.m AS month_num,
    vn.vn AS visit_num,
    CONCAT(s.student_id, '|', mo.m, '|', vn.vn) AS seed_key,
    1 + (CRC32(CONCAT(s.student_id, '|', mo.m, '|1')) % cc.ccount) AS idx1,
    1 + (
      (1 + (CRC32(CONCAT(s.student_id, '|', mo.m, '|1')) % cc.ccount) - 1
       + 1 + (CRC32(CONCAT(s.student_id, '|', mo.m, '|2')) % (cc.ccount - 1))
      ) % cc.ccount
    ) AS idx2
  FROM students s
  CROSS JOIN (
    SELECT 1 AS m UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
    UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
  ) mo
  CROSS JOIN (SELECT 1 AS vn UNION ALL SELECT 2) vn
  CROSS JOIN (SELECT COUNT(*) AS ccount FROM chief_complaints) cc
) sl
CROSS JOIN (SELECT nurse_id FROM nurses LIMIT 1) n
JOIN (SELECT complaint_id, ROW_NUMBER() OVER (ORDER BY complaint_id) AS crow FROM chief_complaints) cr1 ON cr1.crow = sl.idx1
JOIN (SELECT complaint_id, ROW_NUMBER() OVER (ORDER BY complaint_id) AS crow FROM chief_complaints) cr2 ON cr2.crow = sl.idx2;

-- ---------------------------------------------------------------------------
-- STEP 4: Generate consultation_dispensation (1 per generated visit)
-- ---------------------------------------------------------------------------
INSERT INTO consultation_dispensation
  (consultation_dispense_id, visit_id, batch_id, dosage_consumption_unit_value,
   dosage_consumption_unit_of_measure, dispensed_at)
SELECT
  CONCAT('DSEED-', SUBSTRING(cv.visit_id, 7)) AS consultation_dispense_id,
  cv.visit_id,
  (CASE WHEN CRC32(cv.visit_id) % 2 = 0 THEN cmm.batch_a ELSE cmm.batch_b END) AS batch_id,
  ((1 + (CRC32(CONCAT(cv.visit_id, '-qty')) % 2)) * m.strength_unit_value) AS dosage_consumption_unit_value,
  m.strength_unit_of_measure AS dosage_consumption_unit_of_measure,
  TIMESTAMP(cv.visit_date, ADDTIME(cv.time_in, '00:10:00')) AS dispensed_at
FROM clinic_visits cv
JOIN (
  SELECT 'ASTHMAATTACK02000' AS complaint_id, '95242a99-ccf0-4daa-937b-b46516465647' AS med_a, 'fab33ab4-154a-47df-bf6e-26094db500c3' AS batch_a, '95242a99-ccf0-4daa-937b-b46516465647' AS med_b, 'fab33ab4-154a-47df-bf6e-26094db500c3' AS batch_b
  UNION ALL SELECT 'BODYPAIN02000','746979c0-9000-453c-b1b1-902628a46a55','3c67e567-3dad-4efc-9487-d97b01a96d02','34bf9236-7ec0-4caa-88bc-44b77eb323fd','c0f58f5d-5d52-448e-a222-f5be7c0e91c4'
  UNION ALL SELECT 'COUGH02000','78d441a2-a804-4914-b99e-523134df4b47','10decc29-88d8-4f72-8a9b-a50ed530051f','78d441a2-a804-4914-b99e-523134df4b47','10decc29-88d8-4f72-8a9b-a50ed530051f'
  UNION ALL SELECT 'DIFFICULTYOFBREATHING02000','95242a99-ccf0-4daa-937b-b46516465647','fab33ab4-154a-47df-bf6e-26094db500c3','95242a99-ccf0-4daa-937b-b46516465647','fab33ab4-154a-47df-bf6e-26094db500c3'
  UNION ALL SELECT 'DIZZINESS02000','1bada781-8459-450b-a5c3-bfc7e939d05d','c9ac78d4-3dae-470c-b591-872b41ee9327','3a1c21fe-cc4c-47d6-82a8-5db0b0f7db11','ab0d77a9-bf34-45ed-92c0-16a80e5d4d3e'
  UNION ALL SELECT 'FEVER02000','78d441a2-a804-4914-b99e-523134df4b47','3068395a-8dd1-4385-9837-61a31ec3381c','e87d25d1-7480-4bf2-9f07-7d429fddfed1','5a6b7c8d-9e0f-4123-8456-789abc0def12'
  UNION ALL SELECT 'HEADACHE02000','78d441a2-a804-4914-b99e-523134df4b47','66f77537-703c-451e-9049-2f83e41c8e92','cf759a6c-dc47-421d-80ef-f8a8ff8dcb6f','7e3e1eeb-112f-4d9b-b180-9a080ebd9da7'
  UNION ALL SELECT 'HEARTBURN02000','b02c36ec-60ad-492e-a94d-83bb9c905c43','243c576d-4c88-4996-bdc6-61af958c5955','b02c36ec-60ad-492e-a94d-83bb9c905c43','243c576d-4c88-4996-bdc6-61af958c5955'
  UNION ALL SELECT 'HIGHBLOOD02000','cb537e87-ba84-4e45-ba1f-296f5d99f1a3','7cf4eeaa-c4c9-4b25-942a-b3044e80bfc6','cb537e87-ba84-4e45-ba1f-296f5d99f1a3','7cf4eeaa-c4c9-4b25-942a-b3044e80bfc6'
  UNION ALL SELECT 'INJURY02000','4d3b9c42-a916-43c6-90f6-0d8ad06aac52','2d7c8b1a-6e4f-4a93-b1c5-7f8e9d0a1b2c','d4154b74-ef08-4098-bb20-9e64fba7512b','61480fc3-075f-4bfe-a3ef-1fa88d316764'
  UNION ALL SELECT 'LBM02000','3011f28d-95c0-47af-b501-db9fee9650c0','b382f7e2-4c38-47ce-a7c3-71485db849bf','b02c36ec-60ad-492e-a94d-83bb9c905c43','243c576d-4c88-4996-bdc6-61af958c5955'
  UNION ALL SELECT 'LOSTCONSIOUSNESS02000','78d441a2-a804-4914-b99e-523134df4b47','3068395a-8dd1-4385-9837-61a31ec3381c','78d441a2-a804-4914-b99e-523134df4b47','3068395a-8dd1-4385-9837-61a31ec3381c'
  UNION ALL SELECT 'MENSTRUALCRAMPS02000','746979c0-9000-453c-b1b1-902628a46a55','3c67e567-3dad-4efc-9487-d97b01a96d02','746979c0-9000-453c-b1b1-902628a46a55','3c67e567-3dad-4efc-9487-d97b01a96d02'
  UNION ALL SELECT 'NAUSEA02000','3a1c21fe-cc4c-47d6-82a8-5db0b0f7db11','ab0d77a9-bf34-45ed-92c0-16a80e5d4d3e','3a1c21fe-cc4c-47d6-82a8-5db0b0f7db11','ab0d77a9-bf34-45ed-92c0-16a80e5d4d3e'
  UNION ALL SELECT 'OTHERS02000','142851d9-6ad0-4d6a-ae89-970db9000746','9f1e4a3c-5b2d-4e71-8a90-1c2d3e4f5061','142851d9-6ad0-4d6a-ae89-970db9000746','9f1e4a3c-5b2d-4e71-8a90-1c2d3e4f5061'
  UNION ALL SELECT 'RUNNYNOSE02000','95242a99-ccf0-4daa-937b-b46516465647','fab33ab4-154a-47df-bf6e-26094db500c3','95242a99-ccf0-4daa-937b-b46516465647','fab33ab4-154a-47df-bf6e-26094db500c3'
  UNION ALL SELECT 'SORETHROAT02000','78d441a2-a804-4914-b99e-523134df4b47','66f77537-703c-451e-9049-2f83e41c8e92','78d441a2-a804-4914-b99e-523134df4b47','66f77537-703c-451e-9049-2f83e41c8e92'
  UNION ALL SELECT 'TOOTHACHES02000','746979c0-9000-453c-b1b1-902628a46a55','3c67e567-3dad-4efc-9487-d97b01a96d02','cf759a6c-dc47-421d-80ef-f8a8ff8dcb6f','7e3e1eeb-112f-4d9b-b180-9a080ebd9da7'
) cmm ON cmm.complaint_id = cv.complaint_id
JOIN medicines m ON m.medicine_id = (CASE WHEN CRC32(cv.visit_id) % 2 = 0 THEN cmm.med_a ELSE cmm.med_b END)
WHERE cv.visit_id LIKE 'VSEED-%';

-- ---------------------------------------------------------------------------
-- STEP 5: Generate medicine_monthly_stock_snapshots (all 14 medicines x Jan-Oct 2026)
-- ---------------------------------------------------------------------------
INSERT INTO medicine_monthly_stock_snapshots (medicine_id, snapshot_period, snapshot_date, total_stock)
SELECT
  mb.medicine_id,
  CONCAT('2026-', LPAD(mo.m, 2, '0')) AS snapshot_period,
  LAST_DAY(STR_TO_DATE(CONCAT('2026-', LPAD(mo.m, 2, '0'), '-01'), '%Y-%m-%d')) AS snapshot_date,
  GREATEST(1,
    mb.baseline_stock
    + (CRC32(CONCAT(mb.medicine_id, '-2026-', LPAD(mo.m, 2, '0'))) % (2 * GREATEST(3, ROUND(mb.baseline_stock * 0.4)) + 1))
    - GREATEST(3, ROUND(mb.baseline_stock * 0.4))
  ) AS total_stock
FROM (
  SELECT '142851d9-6ad0-4d6a-ae89-970db9000746' AS medicine_id, 10 AS baseline_stock  -- Ethyl Alcohol (100% of OTHERS)
  UNION ALL SELECT '1bada781-8459-450b-a5c3-bfc7e939d05d', 5   -- Betahistine (Serc)
  UNION ALL SELECT '3011f28d-95c0-47af-b501-db9fee9650c0', 5   -- Loperamide (Imodium)
  UNION ALL SELECT '34bf9236-7ec0-4caa-88bc-44b77eb323fd', 12  -- Methyl Salicylate (Salonpas, 50% of BODYPAIN)
  UNION ALL SELECT '3a1c21fe-cc4c-47d6-82a8-5db0b0f7db11', 15  -- Meclizine (Bonamine)
  UNION ALL SELECT '4d3b9c42-a916-43c6-90f6-0d8ad06aac52', 8   -- Bethadine (50% of INJURY)
  UNION ALL SELECT '746979c0-9000-453c-b1b1-902628a46a55', 25  -- Mefenamic Acid (Dolfenal)
  UNION ALL SELECT '78d441a2-a804-4914-b99e-523134df4b47', 40  -- Paracetamol (Biogesic) - highest demand
  UNION ALL SELECT '95242a99-ccf0-4daa-937b-b46516465647', 30  -- Katinko
  UNION ALL SELECT 'b02c36ec-60ad-492e-a94d-83bb9c905c43', 15  -- Aluminum Hydroxide (Kremil-S)
  UNION ALL SELECT 'cb537e87-ba84-4e45-ba1f-296f5d99f1a3', 10  -- Clonidine (Catapres)
  UNION ALL SELECT 'cf759a6c-dc47-421d-80ef-f8a8ff8dcb6f', 30  -- Ibuprofen (Medicol Advance)
  UNION ALL SELECT 'd4154b74-ef08-4098-bb20-9e64fba7512b', 10  -- Band-Aid
  UNION ALL SELECT 'e87d25d1-7480-4bf2-9f07-7d429fddfed1', 10  -- Paracetamol (Bioflu, 50% of FEVER)
) mb
CROSS JOIN (
  SELECT 1 AS m UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
  UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9 UNION ALL SELECT 10
) mo
ON DUPLICATE KEY UPDATE total_stock = VALUES(total_stock);

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification (run after commit)
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) FROM clinic_visits WHERE visit_id LIKE 'VSEED-%';              -- expect 1240
-- SELECT COUNT(*) FROM consultation_dispensation WHERE consultation_dispense_id LIKE 'DSEED-%'; -- expect 1240
-- SELECT COUNT(*) FROM medicine_monthly_stock_snapshots;                        -- expect 140
-- SELECT * FROM medicine_inventory_batches ORDER BY created_at;                 -- all Jan 2026
-- SELECT DATE_FORMAT(visit_date,'%Y-%m') AS ym, COUNT(*) FROM clinic_visits GROUP BY ym ORDER BY ym;
