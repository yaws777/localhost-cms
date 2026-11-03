-- =============================================================================
-- Migration: confirm the end of a check-up session / health screening
--   When the end time passes, the nurse or the doctor confirms the end (the session moves to Past Check-up / Past Screening)
--   or extends it (same date only, then the question comes again). A session whose date passed ends by itself.
--   Check-up sessions: one row per session day in `session_end_confirmations`.
--   Screenings:        `screening_schedules.end_confirmed_at`, `extended_minutes`, `original_end_time`.
-- Idempotent. Run AFTER migration_screening_types.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_session_end_confirmation.sql
-- (The backend also creates these on start; this file is for setting up by hand.)
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_add_column;

DELIMITER $$

CREATE PROCEDURE cms_add_column(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS session_end_confirmations (
  schedule_id  VARCHAR(45) NOT NULL,
  session_date DATE        NOT NULL,
  confirmed_by VARCHAR(45) NULL,
  confirmed_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (schedule_id, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CALL cms_add_column('screening_schedules', 'end_confirmed_at',  'datetime NULL COMMENT ''set when the nurse confirmed the end of the screening''');
CALL cms_add_column('screening_schedules', 'extended_minutes',  'int NOT NULL DEFAULT 0');
CALL cms_add_column('screening_schedules', 'original_end_time', 'time NULL');

DROP PROCEDURE IF EXISTS cms_add_column;
