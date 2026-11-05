-- Custom screening folders (e.g. "Sportsfest Player Screening"): a screening placed in a folder is not tied to one class.
-- Run after migration_school_years.sql. Idempotent. mysql --default-character-set=utf8mb4
-- The backend also creates this on start (ensureScreeningEndColumns).
CREATE TABLE IF NOT EXISTS screening_folders (
  folder_id  INT NOT NULL AUTO_INCREMENT,
  name       VARCHAR(80) NOT NULL,
  created_by VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (folder_id),
  UNIQUE KEY uq_screening_folders_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'screening_schedules' AND COLUMN_NAME = 'folder_id');
SET @sql := IF(@has = 0, 'ALTER TABLE screening_schedules ADD COLUMN folder_id INT NULL, ADD INDEX idx_screening_folder (folder_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
