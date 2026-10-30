-- =============================================================================
-- Migration: listing per schedule (replaces the listing per check-up service)
--   1. The nurse asks a doctor for a schedule (schedule_requests, unchanged).
--   2. The doctor sets the schedule with a listing limit (`doctor_schedules.listing_limit`).
--   3. The nurse opens the listing of that schedule (`doctor_schedules.listing_open`); students see only open listings.
--   4. A student asks for a place in that schedule (`consultation_requests.listing_schedule_id` + `listing_date`,
--      status `Waiting for Approval`). The nurse accepts (the student gets the next queue number of that session,
--      in the order of acceptance) or declines.
-- Idempotent. Run AFTER migration_consultation_services.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_schedule_listing.sql
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;

DELIMITER $$

CREATE PROCEDURE cms_add_column(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

CREATE PROCEDURE cms_add_index(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN cols TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', cols, ')');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- The doctor's listing limit and the nurse's open / closed switch (closed until the nurse opens it)
CALL cms_add_column('doctor_schedules', 'listing_limit',     'int NULL COMMENT ''most students that can be accepted into this session; NULL = the session capacity''');
CALL cms_add_column('doctor_schedules', 'listing_open',      'tinyint(1) NOT NULL DEFAULT 0 COMMENT ''1 = the nurse opened the listing: students can ask for a place''');
CALL cms_add_column('doctor_schedules', 'listing_opened_at', 'datetime NULL');

-- The schedule (and session day) a student asked a place for
CALL cms_add_column('consultation_requests', 'listing_schedule_id', 'varchar(45) NULL');
CALL cms_add_column('consultation_requests', 'listing_date',        'date NULL');
CALL cms_add_index('consultation_requests', 'idx_creq_listing', '`listing_schedule_id`, `listing_date`, `status`');

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
