-- =============================================================================
-- Migration: school years, graduated students (Archive) and the reason an account is inactive
--   school_years                      one row per school year (label 2026-2027, dates, the current one)
--   screening_schedules.school_year   the school year of the screening date
--   students.graduated_at / graduated_school_year   set when the student graduated (leaves the folders, goes to the Archive)
--   students.inactive_reason / inactive_reason_other   Transfer | Graduated | Drop | Other (+ the specified text)
-- Idempotent. Run AFTER migration_session_end_confirmation.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_school_years.sql
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

CREATE TABLE IF NOT EXISTS school_years (
  school_year varchar(9) NOT NULL,
  start_date  date       NOT NULL,
  end_date    date       NOT NULL,
  is_current  tinyint(1) NOT NULL DEFAULT 0,
  created_at  datetime   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (school_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CALL cms_add_column('screening_schedules', 'school_year', 'varchar(9) NULL');
CALL cms_add_column('students', 'graduated_at', 'date NULL');
CALL cms_add_column('students', 'graduated_school_year', 'varchar(9) NULL');
CALL cms_add_column('students', 'inactive_reason', 'varchar(20) NULL');
CALL cms_add_column('students', 'inactive_reason_other', 'varchar(150) NULL');

-- school year runs June to May: a date in June 2026 .. May 2027 is 2026-2027
UPDATE screening_schedules
   SET school_year = CONCAT(IF(MONTH(scheduled_date) >= 6, YEAR(scheduled_date), YEAR(scheduled_date) - 1), '-',
                            IF(MONTH(scheduled_date) >= 6, YEAR(scheduled_date) + 1, YEAR(scheduled_date)))
 WHERE school_year IS NULL;

INSERT IGNORE INTO school_years (school_year, start_date, end_date)
SELECT DISTINCT school_year, STR_TO_DATE(CONCAT(LEFT(school_year, 4), '-06-01'), '%Y-%m-%d'), STR_TO_DATE(CONCAT(RIGHT(school_year, 4), '-05-31'), '%Y-%m-%d')
  FROM screening_schedules WHERE school_year IS NOT NULL;

DROP PROCEDURE IF EXISTS cms_add_column;
