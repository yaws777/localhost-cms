-- =====================================================================================
-- Mock health trend data for Nov 14-18 2026 (Sunday Nov 15 is closed), same volume per condition as Nov 5-9.
-- Health Trends counts a condition once per student per month (first visit), so every mock visit uses a student
-- who has no visit / dispensation for that condition anywhere in November 2026.
-- Per condition (Nov 5-9 = Nov 14-18): Body Pain 10, Dizziness 8, Fever 13, Gastrointestinal Issues 6, Headache 4
-- (1 already on Nov 14), Heartburn 4, High Blood 5, Injury 7, Nausea/Vomiting 3, Others 4, Tootaches 1 = 65.
-- Adds 64 clinic visits (VTRD-*), no medicine, stock not changed. Same rows every run; safe to re-run.
-- Run with: mysql --default-character-set=utf8mb4 -u root -p < seed_health_trends_nov14_18_mock.sql
-- =====================================================================================

USE ClinicManagementSystem;
SET time_zone = '+08:00';
SET SQL_SAFE_UPDATES = 0;
START TRANSACTION;

DELETE FROM clinic_visits WHERE visit_id LIKE 'VTRD-%';

DROP TABLE IF EXISTS trd_plan;
CREATE TABLE trd_plan (complaint_id VARCHAR(45) NOT NULL, visit_date DATE NOT NULL, n INT NOT NULL);
INSERT INTO trd_plan (complaint_id, visit_date, n) VALUES
('BODYPAIN02000','2026-11-14',2),('BODYPAIN02000','2026-11-16',3),('BODYPAIN02000','2026-11-17',3),('BODYPAIN02000','2026-11-18',2),
('DIZZINESS02000','2026-11-14',2),('DIZZINESS02000','2026-11-16',2),('DIZZINESS02000','2026-11-17',2),('DIZZINESS02000','2026-11-18',2),
('FEVER02000','2026-11-14',4),('FEVER02000','2026-11-16',3),('FEVER02000','2026-11-17',4),('FEVER02000','2026-11-18',2),
('LBM02000','2026-11-14',2),('LBM02000','2026-11-16',1),('LBM02000','2026-11-17',2),('LBM02000','2026-11-18',1),
('HEADACHE02000','2026-11-16',1),('HEADACHE02000','2026-11-17',1),('HEADACHE02000','2026-11-18',1),
('HEARTBURN02000','2026-11-14',1),('HEARTBURN02000','2026-11-16',2),('HEARTBURN02000','2026-11-17',1),
('HIGHBLOOD02000','2026-11-14',1),('HIGHBLOOD02000','2026-11-16',2),('HIGHBLOOD02000','2026-11-17',1),('HIGHBLOOD02000','2026-11-18',1),
('INJURY02000','2026-11-14',2),('INJURY02000','2026-11-16',2),('INJURY02000','2026-11-17',2),('INJURY02000','2026-11-18',1),
('NAUSEA02000','2026-11-14',1),('NAUSEA02000','2026-11-16',1),('NAUSEA02000','2026-11-18',1),
('OTHERS02000','2026-11-14',1),('OTHERS02000','2026-11-16',1),('OTHERS02000','2026-11-17',1),('OTHERS02000','2026-11-18',1),
('TOOTHACHES02000','2026-11-16',1);

INSERT INTO clinic_visits (visit_id, student_id, nurse_id, complaint_id, specify_complaint_text, visit_date, time_in, time_out,
                           temperature, respiratory_rate, pulse_rate, blood_pressure, nursing_intervention, assessment)
WITH slots AS (
  SELECT p.complaint_id, p.visit_date, k.k,
         ROW_NUMBER() OVER (PARTITION BY p.complaint_id ORDER BY p.visit_date, k.k) AS slot_rank
  FROM trd_plan p
  JOIN (SELECT 1 AS k UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4) k ON k.k <= p.n
),
eligible AS (
  SELECT c.complaint_id, s.student_id,
         ROW_NUMBER() OVER (PARTITION BY c.complaint_id ORDER BY MD5(CONCAT(s.student_id, c.complaint_id))) AS student_rank
  FROM (SELECT DISTINCT complaint_id FROM trd_plan) c
  CROSS JOIN students s
  WHERE NOT EXISTS (
    SELECT 1 FROM clinic_visits cv
    WHERE cv.student_id = s.student_id AND cv.complaint_id = c.complaint_id
      AND cv.visit_date BETWEEN '2026-11-01' AND '2026-11-30')
    AND NOT EXISTS (
    SELECT 1 FROM direct_dispensation dd
    WHERE dd.student_id = s.student_id AND dd.complaint_id = c.complaint_id
      AND DATE(dd.dispensed_at) BETWEEN '2026-11-01' AND '2026-11-30')
),
picked AS (
  SELECT sl.complaint_id, sl.visit_date, sl.slot_rank, e.student_id,
         ROW_NUMBER() OVER (ORDER BY sl.visit_date, sl.complaint_id, sl.slot_rank) AS seq
  FROM slots sl
  JOIN eligible e ON e.complaint_id = sl.complaint_id AND e.student_rank = sl.slot_rank
)
SELECT CONCAT('VTRD-', LPAD(seq, 5, '0')), student_id, 'NURSE02000', complaint_id, NULL, visit_date,
       SEC_TO_TIME(8 * 3600 + MOD(seq * 463, 480) * 60),
       SEC_TO_TIME(8 * 3600 + MOD(seq * 463, 480) * 60 + (6 + MOD(seq, 12)) * 60),
       IF(complaint_id = 'FEVER02000', CAST(37.8 + MOD(seq, 15) / 10 AS CHAR), CAST(36.2 + MOD(seq, 9) / 10 AS CHAR)),
       CAST(16 + MOD(seq, 5) AS CHAR), CAST(64 + MOD(seq * 3, 25) AS CHAR),
       CONCAT(104 + MOD(seq, 15), '/', 68 + MOD(seq, 10)),
       'Rested and advised.', 'Stable; follow-up as needed.'
FROM picked;

DROP TABLE IF EXISTS trd_plan;
COMMIT;
