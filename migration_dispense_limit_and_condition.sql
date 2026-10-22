-- =============================================================================
-- Migration: dispense limit / dispense unit of measure + medical condition on
--            direct dispensation + medicine_indications linkage index
-- Database : ClinicManagementSystem (MySQL 8.0.16+, needs CHECK support)
--
-- What changes
--   1. medicines.strength_*  now ONLY describes the package (e.g. 500 mg per tablet).
--   2. medicines.avg_dosage_consumption_value            => "Dispense Limit"
--      medicines.avg_dosage_consumption_unit_of_measure  => "Dispense Unit of Measure"
--      (column names are kept so the forecast / dashboards keep working; only the
--       meaning changes). A Tablet with strength "500 mg" may now be dispensed in
--       "Tablet/s" with a limit of 1.
--   3. The old CHECK chk_consumption_unit_hierarchy forced the dispense unit to be
--      mg/mcg when the strength unit was mg - it is replaced by two new checks.
--   4. direct_dispensation.complaint_id records the medical condition
--      (chief_complaints) the medicine was dispensed for.
--   5. Index to make the medicine -> medical condition lookup (medicine_indications)
--      fast when filtering dispensable batches.
--
-- Run once. Take a backup first:  mysqldump ClinicManagementSystem > backup.sql
-- =============================================================================

USE ClinicManagementSystem;

-- -----------------------------------------------------------------------------
-- 1. Drop the old strength -> dosage-unit hierarchy rule
-- -----------------------------------------------------------------------------
ALTER TABLE medicines DROP CHECK chk_consumption_unit_hierarchy;

-- Document the new meaning of the columns
ALTER TABLE medicines
  MODIFY COLUMN avg_dosage_consumption_value decimal(10,2) DEFAULT '0.00'
    COMMENT 'Dispense limit: max quantity per dispensation, expressed in avg_dosage_consumption_unit_of_measure',
  MODIFY COLUMN avg_dosage_consumption_unit_of_measure
    enum('mg','g','mcg','mL','L','Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.') NOT NULL
    COMMENT 'Dispense unit of measure (Tablet/s, Capsule/s, mL, ...)';

-- -----------------------------------------------------------------------------
-- 2. Convert existing medicines to the new model
--    Old: Tablet 500 mg, "avg dosage" 500 mg      -> New: dispense limit 1 Tablet/s
--    Only piece-type forms measured by weight are converted; liquids / topicals
--    (mL, g) keep dispensing by volume / weight.
-- -----------------------------------------------------------------------------
UPDATE medicines
SET avg_dosage_consumption_value = GREATEST(1, IFNULL(ROUND(
        (avg_dosage_consumption_value * CASE avg_dosage_consumption_unit_of_measure
              WHEN 'g' THEN 1000000 WHEN 'mg' THEN 1000 WHEN 'mcg' THEN 1 END)
      / NULLIF(strength_unit_value * CASE strength_unit_of_measure
              WHEN 'g' THEN 1000000 WHEN 'mg' THEN 1000 WHEN 'mcg' THEN 1 END, 0)
    ), 1)),
    avg_dosage_consumption_unit_of_measure = CASE dosage_form
        WHEN 'Tablet'            THEN 'Tablet/s'
        WHEN 'Capsule'           THEN 'Capsule/s'
        WHEN 'Sachet'            THEN 'Sachet'
        WHEN 'Patch'             THEN 'Patch/es'
        WHEN 'Inhaler'           THEN 'Inhaler'
        WHEN 'Vial'              THEN 'Vial'
        WHEN 'Prefilled Syringe' THEN 'Prefilled Syringe'
        WHEN 'Spray'             THEN 'Spray/s'
    END
WHERE dosage_form IN ('Tablet','Capsule','Sachet','Patch','Inhaler','Vial','Prefilled Syringe','Spray')
  AND strength_unit_of_measure IN ('mg','g','mcg')
  AND avg_dosage_consumption_unit_of_measure IN ('mg','g','mcg');

-- Batches of piece-type medicines track whole units only (remaining_volume = 1)
UPDATE medicine_inventory_batches b
JOIN medicines m ON m.medicine_id = b.medicine_id
SET b.remaining_volume = IF(b.current_stock > 0, 1.00, 0.00)
WHERE m.avg_dosage_consumption_unit_of_measure IN
      ('Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es')
  AND m.strength_unit_of_measure IN ('mg','g','mcg');

-- -----------------------------------------------------------------------------
-- 3. New rules
--    a) the dispense unit must be valid for the dosage form
--    b) the dispense unit must be a piece unit, or a unit convertible from the
--       strength unit (so remaining_volume can be deducted)
-- -----------------------------------------------------------------------------
ALTER TABLE medicines ADD CONSTRAINT chk_valid_dispense_units CHECK (
     (dosage_form = 'Tablet'            AND avg_dosage_consumption_unit_of_measure = 'Tablet/s')
  OR (dosage_form = 'Capsule'           AND avg_dosage_consumption_unit_of_measure = 'Capsule/s')
  OR (dosage_form = 'Sachet'            AND avg_dosage_consumption_unit_of_measure = 'Sachet')
  OR (dosage_form = 'Patch'             AND avg_dosage_consumption_unit_of_measure = 'Patch/es')
  OR (dosage_form = 'Inhaler'           AND avg_dosage_consumption_unit_of_measure = 'Inhaler')
  OR (dosage_form IN ('Syrup','Suspension','Drops','Bottle')
        AND avg_dosage_consumption_unit_of_measure IN ('mL','L','mg','mcg'))
  OR (dosage_form = 'Vial'              AND avg_dosage_consumption_unit_of_measure IN ('Vial','mL','L'))
  OR (dosage_form = 'Prefilled Syringe' AND avg_dosage_consumption_unit_of_measure IN ('Prefilled Syringe','mL'))
  OR (dosage_form IN ('Ointment','Cream','Gel')
        AND avg_dosage_consumption_unit_of_measure IN ('g','mg','mL'))
  OR (dosage_form = 'Spray'             AND avg_dosage_consumption_unit_of_measure IN ('Spray/s','mL'))
  OR (dosage_form = 'Box'               AND avg_dosage_consumption_unit_of_measure IN ('Box/es','pcs.','mg','g','mcg','mL'))
);

ALTER TABLE medicines ADD CONSTRAINT chk_dispense_unit_hierarchy CHECK (
     avg_dosage_consumption_unit_of_measure IN
        ('Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es')
  OR (strength_unit_of_measure IN
        ('Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.')
        AND avg_dosage_consumption_unit_of_measure = strength_unit_of_measure)
  OR (strength_unit_of_measure = 'g'   AND avg_dosage_consumption_unit_of_measure IN ('g','mg','mcg'))
  OR (strength_unit_of_measure = 'mg'  AND avg_dosage_consumption_unit_of_measure IN ('mg','mcg'))
  OR (strength_unit_of_measure = 'mcg' AND avg_dosage_consumption_unit_of_measure = 'mcg')
  OR (strength_unit_of_measure = 'L'   AND avg_dosage_consumption_unit_of_measure IN ('L','mL'))
  OR (strength_unit_of_measure = 'mL'  AND avg_dosage_consumption_unit_of_measure = 'mL')
);

-- -----------------------------------------------------------------------------
-- 4. Medical condition (chief complaint) on direct dispensation
--    Nullable: historical rows have no recorded condition. The API requires it
--    for every new dispensation. Consultation dispensation already gets its
--    condition from clinic_visits.complaint_id.
-- -----------------------------------------------------------------------------
ALTER TABLE direct_dispensation
  ADD COLUMN complaint_id varchar(45) NULL AFTER batch_id,
  ADD KEY idx_direct_dispensation_complaint (complaint_id),
  ADD CONSTRAINT fk_direct_dispensation_complaint
      FOREIGN KEY (complaint_id) REFERENCES chief_complaints (complaint_id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 5. Fast "is this medicine indicated for this medical condition?" lookups
-- -----------------------------------------------------------------------------
CREATE INDEX idx_medicine_indications_complaint_medicine
  ON medicine_indications (complaint_id, medicine_id);

-- =============================================================================
-- Rollback (only valid if no Tablet/Capsule/... rows were saved with a piece
-- dispense unit while the strength unit is mg/g/mcg - restore from backup then):
--   DROP INDEX idx_medicine_indications_complaint_medicine ON medicine_indications;
--   ALTER TABLE direct_dispensation DROP FOREIGN KEY fk_direct_dispensation_complaint,
--       DROP KEY idx_direct_dispensation_complaint, DROP COLUMN complaint_id;
--   ALTER TABLE medicines DROP CHECK chk_dispense_unit_hierarchy,
--                         DROP CHECK chk_valid_dispense_units;
-- =============================================================================
