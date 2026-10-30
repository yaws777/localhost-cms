-- =========================================================================
-- Consultation services: listing control.
--   * A student's listing request waits for the nurse (`consultation_requests.status = 'Waiting for Approval'`, `queue_no` NULL).
--     The waiting list number is taken only when the nurse accepts it.
--   * The nurse opens / closes the listing of each consultation service and sets how many accepted listings it takes.
-- Run after migration_queue_waiting_list.sql and migration_consultations_offered.sql (idempotent).
-- Use: mysql --default-character-set=utf8mb4 ClinicManagementSystem < migration_consultation_services.sql
-- (the backend also creates this table on first use, with the same DDL)
-- =========================================================================

CREATE TABLE IF NOT EXISTS consultation_service_listing (
  visit_type    varchar(30) NOT NULL,
  listing_open  tinyint(1)  NOT NULL DEFAULT 1 COMMENT '0 = the nurse closed the listing: students cannot ask for this service',
  listing_limit int         NULL COMMENT 'most accepted listings at once; NULL = no limit',
  updated_at    timestamp   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (visit_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
