-- =============================================================================
-- Migration: numbered waiting list + doctor-run session queue
--   * Students no longer book a time block. They request a consultation and are listed in the waiting list of the
--     service category they picked (`visit_type`); each request gets a queue number (`queue_no`) in the order of the
--     request, taken from `queue_counters` (one counter per category).
--   * The nurse appoints students one by one into a doctor's session. Inside a session every appointed student gets a
--     session queue number (`doctor_appointments.queue_no`) in one of two lanes: `Listed` (appointed) or `Walk-in`
--     (served only after the listed lane). The doctor calls the numbers (`queue_state`).
--   * Request status `Missed` = the student's number was skipped (void). The approval step is gone: a request is
--     `Waiting List` right away. `Waiting for Approval` / `Booked` stay in the CHECK for old rows only.
--   * `schedule_requests`: the nurse asks a doctor for a schedule; the doctor sets it (or declines).
-- Idempotent. Run AFTER migration_specializations_visit_types.sql.
-- Run with:  mysql --default-character-set=utf8mb4 -u root -p < migration_queue_waiting_list.sql
-- =============================================================================

USE ClinicManagementSystem;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_drop_check;

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

CREATE PROCEDURE cms_drop_check(IN tbl VARCHAR(64), IN chk VARCHAR(64))
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.CHECK_CONSTRAINTS
             WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = chk) THEN
    SET @ddl = CONCAT('ALTER TABLE `', tbl, '` DROP CHECK `', chk, '`');
    PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- 1. Waiting list numbers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS queue_counters (
  visit_type varchar(30) NOT NULL,
  last_no    int         NOT NULL DEFAULT 0,
  PRIMARY KEY (visit_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CALL cms_add_column('consultation_requests', 'queue_no',
  'int NULL COMMENT ''number in the waiting list of this visit_type, in the order of the request'' AFTER visit_type');
CALL cms_add_index('consultation_requests', 'idx_cr_queue', '`visit_type`, `queue_no`');

-- old rows: waiting for approval is now simply on the waiting list
UPDATE consultation_requests SET status = 'Waiting List' WHERE status = 'Waiting for Approval';

-- student-booked slots that were still waiting for approval are declined; the student goes back on the list
UPDATE consultation_requests cr
JOIN doctor_appointments da ON da.appointment_id = cr.appointment_id AND da.status = 'Waiting for Approval'
SET cr.status = 'Waiting List', cr.appointment_id = NULL, cr.reconfirm_response = NULL
WHERE cr.status IN ('Booked', 'Appointed');

UPDATE doctor_appointments
SET status = 'Declined', decline_reason = COALESCE(decline_reason, 'Booking was replaced by the waiting list')
WHERE status = 'Waiting for Approval';

-- booked slots that were confirmed count as appointed
UPDATE consultation_requests SET status = 'Appointed' WHERE status = 'Booked';

CALL cms_drop_check('consultation_requests', 'chk_cr_status');
ALTER TABLE consultation_requests ADD CONSTRAINT chk_cr_status CHECK (status IN (
  'Waiting for Approval', 'Denied', 'Waiting List', 'Awaiting Reconfirmation', 'Reconfirmed',
  'Appointed', 'Booked', 'Fulfilled', 'Missed', 'Withdrawn'));

ALTER TABLE consultation_requests
  MODIFY COLUMN status varchar(30) NOT NULL DEFAULT 'Waiting List'
  COMMENT 'Waiting List | Awaiting Reconfirmation | Reconfirmed | Appointed | Fulfilled | Missed | Denied | Withdrawn (Waiting for Approval / Booked: legacy)';

-- numbers for the requests that already exist: order of the request, one sequence per category
UPDATE consultation_requests cr
JOIN (
  SELECT request_id,
         ROW_NUMBER() OVER (PARTITION BY visit_type ORDER BY created_at, request_id) AS rn
  FROM consultation_requests
) n ON n.request_id = cr.request_id
SET cr.queue_no = n.rn
WHERE cr.queue_no IS NULL;

INSERT INTO queue_counters (visit_type, last_no)
SELECT visit_type, MAX(queue_no) FROM consultation_requests GROUP BY visit_type
ON DUPLICATE KEY UPDATE last_no = GREATEST(last_no, VALUES(last_no));

-- ---------------------------------------------------------------------------
-- 2. Session queue (inside a doctor's session)
-- ---------------------------------------------------------------------------
CALL cms_add_column('doctor_appointments', 'queue_lane',
  'varchar(8) NULL COMMENT ''Listed (appointed by staff) | Walk-in (served after the listed lane)''');
CALL cms_add_column('doctor_appointments', 'queue_no',
  'smallint NULL COMMENT ''number inside the session and lane for that day''');
CALL cms_add_column('doctor_appointments', 'queue_state',
  'varchar(10) NULL COMMENT ''Waiting | Serving | Done | Void''');
CALL cms_add_column('doctor_appointments', 'queue_called_at', 'timestamp NULL');
CALL cms_add_column('doctor_appointments', 'queue_notified_at', 'timestamp NULL COMMENT ''the "your turn is near" notice was sent''');
CALL cms_add_index('doctor_appointments', 'idx_da_queue', '`schedule_id`, `start_time`, `queue_lane`, `queue_no`');

CALL cms_drop_check('doctor_appointments', 'chk_da_queue_lane');
CALL cms_drop_check('doctor_appointments', 'chk_da_queue_state');
ALTER TABLE doctor_appointments
  ADD CONSTRAINT chk_da_queue_lane  CHECK (queue_lane  IS NULL OR queue_lane  IN ('Listed', 'Walk-in')),
  ADD CONSTRAINT chk_da_queue_state CHECK (queue_state IS NULL OR queue_state IN ('Waiting', 'Serving', 'Done', 'Void'));

-- appointments that already sit in a session start in the queue (numbered by their time)
UPDATE doctor_appointments da
JOIN (
  SELECT appointment_id,
         ROW_NUMBER() OVER (
           PARTITION BY schedule_id, DATE(start_time), (booking_source = 'Walk-in')
           ORDER BY start_time, appointment_id) AS rn
  FROM doctor_appointments
  WHERE schedule_id IS NOT NULL AND status = 'Scheduled' AND queue_no IS NULL AND end_time >= NOW()
) n ON n.appointment_id = da.appointment_id
SET da.queue_no = n.rn,
    da.queue_lane = IF(da.booking_source = 'Walk-in', 'Walk-in', 'Listed'),
    da.queue_state = 'Waiting';

-- ---------------------------------------------------------------------------
-- 3. Schedule requests (nurse -> doctor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedule_requests (
  schedule_request_id  varchar(45)  NOT NULL,
  doctor_id            varchar(45)  NOT NULL,
  visit_type           varchar(30)  NOT NULL DEFAULT 'Any',
  requested_by_nurse_id varchar(45) NULL,
  preferred_date       date         NULL,
  preferred_start      time         NULL,
  preferred_end        time         NULL,
  note                 varchar(255) NULL,
  status               varchar(10)  NOT NULL DEFAULT 'Pending' COMMENT 'Pending | Scheduled | Declined | Cancelled',
  decline_reason       varchar(255) NULL,
  schedule_id          varchar(45)  NULL COMMENT 'the schedule the doctor set for this request',
  responded_at         timestamp    NULL,
  created_at           timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (schedule_request_id),
  KEY idx_sr_doctor (doctor_id, status),
  CONSTRAINT fk_sr_doctor FOREIGN KEY (doctor_id) REFERENCES doctors (doctor_id),
  CONSTRAINT fk_sr_nurse  FOREIGN KEY (requested_by_nurse_id) REFERENCES nurses (nurse_id) ON DELETE SET NULL,
  CONSTRAINT chk_sr_status CHECK (status IN ('Pending', 'Scheduled', 'Declined', 'Cancelled'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP PROCEDURE IF EXISTS cms_add_column;
DROP PROCEDURE IF EXISTS cms_add_index;
DROP PROCEDURE IF EXISTS cms_drop_check;
