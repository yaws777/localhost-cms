-- What the medical condition is, for conditions that need it (Injury, Others, Gastrointestinal issues, Body pain) on a direct dispensation.
-- The backend also adds this column on start (ensureDirectDispenseSpecifyColumn).
-- Run with --default-character-set=utf8mb4.
DROP PROCEDURE IF EXISTS add_direct_dispense_specify;
DELIMITER //
CREATE PROCEDURE add_direct_dispense_specify()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'direct_dispensation' AND COLUMN_NAME = 'specify_complaint_text') THEN
    ALTER TABLE direct_dispensation ADD COLUMN specify_complaint_text varchar(255) NULL;
  END IF;
END //
DELIMITER ;
CALL add_direct_dispense_specify();
DROP PROCEDURE add_direct_dispense_specify;
