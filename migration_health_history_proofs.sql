-- =============================================================================
-- Migration: optional supporting proof per Health History condition
-- Database : ClinicManagementSystem (MySQL 8.0)
--
-- What changes
--   * New table student_health_proofs: one optional uploaded file per
--     (student, health condition). condition_key is the has_* flag of the
--     condition in student_health_information (e.g. 'has_asthma').
--   * Nothing is added to student_health_information and no column becomes
--     required, so every proof stays optional.
--   * emergency_contacts is left untouched (no longer written by the app).
--
-- Idempotent: safe to re-run.
-- Run with:  mysql --default-character-set=utf8mb4 -u root < migration_health_history_proofs.sql
-- Take a backup first:  mysqldump ClinicManagementSystem > backup.sql
-- =============================================================================

USE ClinicManagementSystem;

CREATE TABLE IF NOT EXISTS student_health_proofs (
  proof_id        varchar(45)  NOT NULL,
  student_id      varchar(45)  NOT NULL,
  condition_key   varchar(64)  NOT NULL COMMENT 'has_* flag in student_health_information',
  file_url        varchar(512) NOT NULL,
  original_name   varchar(255) DEFAULT NULL,
  uploaded_at     timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (proof_id),
  UNIQUE KEY uq_student_condition (student_id, condition_key),
  CONSTRAINT student_health_proofs_ibfk_1 FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
