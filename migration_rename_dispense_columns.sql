-- Database : ClinicManagementSystem (run AFTER migration_dispense_limit_and_condition.sql
--            and migration_medicine_configuration.sql)
--
-- Renames the medicine dispense columns to match what they now store:
--   medicines.avg_dosage_consumption_value            => dispense_limit
--   medicines.avg_dosage_consumption_unit_of_measure  => dispense_unit_of_measure
--
-- Rollback:
--   ALTER TABLE medicines
--     CHANGE COLUMN dispense_limit avg_dosage_consumption_value decimal(10,2) DEFAULT '0.00',
--     CHANGE COLUMN dispense_unit_of_measure avg_dosage_consumption_unit_of_measure <same enum> NOT NULL;

USE ClinicManagementSystem;

-- The two check constraints reference the old column names, so they are dropped and recreated.
ALTER TABLE medicines
  DROP CHECK chk_valid_dispense_units,
  DROP CHECK chk_dispense_unit_hierarchy,
  CHANGE COLUMN avg_dosage_consumption_value dispense_limit decimal(10,2) DEFAULT '0.00'
    COMMENT 'Dispense limit: max quantity per dispensation, expressed in dispense_unit_of_measure',
  CHANGE COLUMN avg_dosage_consumption_unit_of_measure dispense_unit_of_measure
    enum('mg','g','mcg','mL','L','Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.') NOT NULL
    COMMENT 'Dispense unit of measure (Tablet/s, Capsule/s, mL, ...)';

ALTER TABLE medicines ADD CONSTRAINT chk_valid_dispense_units CHECK (
     (dosage_form = 'Tablet'            AND dispense_unit_of_measure = 'Tablet/s')
  OR (dosage_form = 'Capsule'           AND dispense_unit_of_measure = 'Capsule/s')
  OR (dosage_form = 'Sachet'            AND dispense_unit_of_measure = 'Sachet')
  OR (dosage_form = 'Patch'             AND dispense_unit_of_measure = 'Patch/es')
  OR (dosage_form = 'Inhaler'           AND dispense_unit_of_measure = 'Inhaler')
  OR (dosage_form IN ('Syrup','Suspension','Drops','Bottle')
        AND dispense_unit_of_measure IN ('mL','L','mg','mcg'))
  OR (dosage_form = 'Vial'              AND dispense_unit_of_measure IN ('Vial','mL','L'))
  OR (dosage_form = 'Prefilled Syringe' AND dispense_unit_of_measure IN ('Prefilled Syringe','mL'))
  OR (dosage_form IN ('Ointment','Cream','Gel')
        AND dispense_unit_of_measure IN ('g','mg','mL'))
  OR (dosage_form = 'Spray'             AND dispense_unit_of_measure IN ('Spray/s','mL'))
  OR (dosage_form = 'Box'               AND dispense_unit_of_measure IN ('Box/es','pcs.','mg','g','mcg','mL'))
);

ALTER TABLE medicines ADD CONSTRAINT chk_dispense_unit_hierarchy CHECK (
     dispense_unit_of_measure IN
        ('Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es')
  OR (strength_unit_of_measure IN
        ('Tablet/s','Capsule/s','Patch/es','Sachet','Vial','Prefilled Syringe','Spray/s','Inhaler','Box/es','pcs.')
        AND dispense_unit_of_measure = strength_unit_of_measure)
  OR (strength_unit_of_measure = 'g'   AND dispense_unit_of_measure IN ('g','mg','mcg'))
  OR (strength_unit_of_measure = 'mg'  AND dispense_unit_of_measure IN ('mg','mcg'))
  OR (strength_unit_of_measure = 'mcg' AND dispense_unit_of_measure = 'mcg')
  OR (strength_unit_of_measure = 'L'   AND dispense_unit_of_measure IN ('L','mL'))
  OR (strength_unit_of_measure = 'mL'  AND dispense_unit_of_measure = 'mL')
);
