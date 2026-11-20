-- Hours a student must wait before the same medicine can be released again (NULL = no gap).
-- Idempotent; the backend also adds the column on start (ensureMedicineIntervalColumn).
SET @has_col := (SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'medicines' AND COLUMN_NAME = 'min_hours_between_doses');
SET @sql := IF(@has_col = 0,
               'ALTER TABLE medicines ADD COLUMN min_hours_between_doses decimal(5,2) NULL',
               'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
