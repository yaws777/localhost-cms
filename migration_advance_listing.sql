-- Advance listing: students register for a check-up service before any schedule exists.
-- Run after migration_school_years.sql. Idempotent. Use: mysql --default-character-set=utf8mb4 ClinicManagementSystem < migration_advance_listing.sql
-- The backend also creates all of this on start (ensureAdvanceListing).

CREATE TABLE IF NOT EXISTS advance_listing_settings (
    setting_id TINYINT NOT NULL PRIMARY KEY,
    is_open TINYINT(1) NOT NULL DEFAULT 0,
    opened_at DATETIME NULL,
    closes_at DATETIME NULL,
    updated_by_user_id VARCHAR(45) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO advance_listing_settings (setting_id, is_open) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS advance_listing_services (
    visit_type VARCHAR(60) NOT NULL PRIMARY KEY,
    listing_limit INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS advance_listing_entries (
    entry_id VARCHAR(45) NOT NULL PRIMARY KEY,
    student_id VARCHAR(45) NOT NULL,
    visit_type VARCHAR(60) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    advance_no INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Waiting',
    schedule_id VARCHAR(45) NULL,
    session_date DATE NULL,
    appointment_id VARCHAR(45) NULL,
    remove_reason VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_advance_student (student_id, status),
    INDEX idx_advance_service (visit_type, status),
    INDEX idx_advance_schedule (schedule_id, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- schedule requests made for the advance listing of one service
SET @has_for_advance := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_requests' AND COLUMN_NAME = 'for_advance');
SET @sql := IF(@has_for_advance = 0, 'ALTER TABLE schedule_requests ADD COLUMN for_advance TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_advance_count := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'schedule_requests' AND COLUMN_NAME = 'advance_count');
SET @sql := IF(@has_advance_count = 0, 'ALTER TABLE schedule_requests ADD COLUMN advance_count INT NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
