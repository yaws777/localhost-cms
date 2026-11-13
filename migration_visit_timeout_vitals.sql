-- Vital signs and nurse note (health condition after time out) recorded at time out (clinic visit log).
-- Time-in vitals stay in temperature / respiratory_rate / pulse_rate / blood_pressure.
-- The backend also adds these columns on start (ensureVisitOutVitalsColumns).
-- Run with --default-character-set=utf8mb4.
DROP PROCEDURE IF EXISTS add_visit_out_vitals;
DELIMITER //
CREATE PROCEDURE add_visit_out_vitals()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clinic_visits' AND COLUMN_NAME = 'out_temperature') THEN
    ALTER TABLE clinic_visits ADD COLUMN out_temperature varchar(45) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clinic_visits' AND COLUMN_NAME = 'out_respiratory_rate') THEN
    ALTER TABLE clinic_visits ADD COLUMN out_respiratory_rate varchar(45) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clinic_visits' AND COLUMN_NAME = 'out_pulse_rate') THEN
    ALTER TABLE clinic_visits ADD COLUMN out_pulse_rate varchar(45) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clinic_visits' AND COLUMN_NAME = 'out_blood_pressure') THEN
    ALTER TABLE clinic_visits ADD COLUMN out_blood_pressure varchar(45) NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clinic_visits' AND COLUMN_NAME = 'out_nurse_note') THEN
    ALTER TABLE clinic_visits ADD COLUMN out_nurse_note text NULL;
  END IF;
END //
DELIMITER ;
CALL add_visit_out_vitals();
DROP PROCEDURE add_visit_out_vitals;
