-- =============================================================================
-- Migration: Automated restock reports (section G)
-- Database : ClinicManagementSystem (MySQL 8.0.16+)
--
-- Idempotent: safe to re-run. Nothing existing is changed.
--   medicine_restock_reports        one row per generated report (history is kept)
--   medicine_restock_report_items   the medicines that needed attention in that report (snapshot)
--   medicine_stock_state            last known stock status per medicine, so a status change
--                                   notifies once instead of on every run
-- Run with:  mysql --default-character-set=utf8mb4 -u root < migration_restock_reports.sql
-- =============================================================================

USE ClinicManagementSystem;

CREATE TABLE IF NOT EXISTS medicine_restock_reports (
  report_id        varchar(45)  NOT NULL,
  generated_at     timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  trigger_source   varchar(20)  NOT NULL COMMENT 'Scheduled | Stock change | Manual',
  generated_by     varchar(45)  NULL,
  total_medicines  int          NOT NULL DEFAULT 0,
  out_count        int          NOT NULL DEFAULT 0,
  critical_count   int          NOT NULL DEFAULT 0,
  low_count        int          NOT NULL DEFAULT 0,
  expiring_count   int          NOT NULL DEFAULT 0,
  expired_count    int          NOT NULL DEFAULT 0,
  PRIMARY KEY (report_id),
  KEY idx_restock_generated_at (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS medicine_restock_report_items (
  item_id          bigint       NOT NULL AUTO_INCREMENT,
  report_id        varchar(45)  NOT NULL,
  medicine_id      varchar(45)  NOT NULL,
  medicine_name    varchar(255) NOT NULL,
  dosage_form      varchar(30)  NULL,
  unit_label       varchar(30)  NULL,
  status           varchar(15)  NOT NULL COMMENT 'Out of stock | Critical | Low | Adequate',
  usable_stock     decimal(12,2) NOT NULL DEFAULT 0,
  total_stock      decimal(12,2) NOT NULL DEFAULT 0,
  low_level        int          NOT NULL DEFAULT 0,
  critical_level   int          NOT NULL DEFAULT 0,
  adequate_level   int          NOT NULL DEFAULT 0,
  forecast_30d     decimal(12,2) NOT NULL DEFAULT 0 COMMENT 'Forecast demand for the next 30 days, in stock units',
  suggested_qty    int          NOT NULL DEFAULT 0 COMMENT 'forecast + critical level - usable stock (never negative)',
  to_adequate_qty  int          NOT NULL DEFAULT 0 COMMENT 'adequate level - usable stock (never negative)',
  nearest_expiry   date         NULL,
  expiring_stock   int          NOT NULL DEFAULT 0 COMMENT 'Stock expiring within 30 days',
  expired_stock    int          NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id),
  KEY idx_restock_item_report (report_id),
  CONSTRAINT fk_restock_item_report FOREIGN KEY (report_id) REFERENCES medicine_restock_reports (report_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS medicine_stock_state (
  medicine_id           varchar(45) NOT NULL,
  last_status           varchar(15) NOT NULL,
  status_since          timestamp   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_notified_status  varchar(15) NULL,
  last_notified_at      timestamp   NULL,
  PRIMARY KEY (medicine_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
