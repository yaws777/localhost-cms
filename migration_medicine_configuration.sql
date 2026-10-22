-- =============================================================================
-- Data fix: correct strength / dispense configuration of existing medicines
-- Database : ClinicManagementSystem (run AFTER migration_dispense_limit_and_condition.sql)
--
-- Strength describes the package (per tablet / patch); the dispense limit + unit
-- (avg_dosage_consumption_*) describe how much is handed out per dispensation.
--
--   Medicine          was                    now
--   Catapres          75 mg                  75 mcg      (clonidine tablets are 75 mcg)
--   Band-Aid          10 mg (Patch)          1 Patch/es  (a bandage has no mg strength)
--   Biogesic          1 Tablet/s (legacy)    500 mg
--   Bioflu            1 Tablet/s (legacy)    500 mg      (paracetamol content)
--   Kremil-S          1 Tablet/s (legacy)    178 mg      (aluminum hydroxide content)
--
-- Dispense limit/unit, stock levels and indications are unchanged.
-- Rollback: set the "was" values back with the same UPDATE pattern.
-- =============================================================================

USE ClinicManagementSystem;

UPDATE medicines SET strength_unit_value = 75.00,  strength_unit_of_measure = 'mcg'      WHERE brand_name = 'Catapres';
UPDATE medicines SET strength_unit_value = 1.00,   strength_unit_of_measure = 'Patch/es' WHERE brand_name = 'Band-Aid';
UPDATE medicines SET strength_unit_value = 500.00, strength_unit_of_measure = 'mg'       WHERE brand_name IN ('Biogesic', 'Bioflu');
UPDATE medicines SET strength_unit_value = 178.00, strength_unit_of_measure = 'mg'       WHERE brand_name = 'Kremil-S';

-- =============================================================================
-- Stock levels, derived from dispensing history (Jan-Oct 2026, converted to stock units)
--   critical = ~2 weeks of demand, low = 1 month, adequate = 2 months
--   (floor of 2-4 for slow movers). Alcohol (7/3/10) and Katinko Spray (10/5/20)
--   are unchanged: their recorded volumes are not usable as bottle demand.
--   Previous values for all changed rows: low 10 / critical 5 / adequate 20.
-- =============================================================================
UPDATE medicines SET
  low_stock_level = CASE brand_name WHEN 'Band-Aid' THEN 17 WHEN 'Bethadine' THEN 4 WHEN 'Bioflu' THEN 5 WHEN 'Biogesic' THEN 75 WHEN 'Bonamine' THEN 18 WHEN 'Catapres' THEN 13 WHEN 'Dolfenal' THEN 28 WHEN 'Imodium' THEN 6 WHEN 'Kremil-S' THEN 19 WHEN 'Medicol Advance' THEN 13 WHEN 'Salonpas' THEN 7 WHEN 'Serc' THEN 6 END,
  critical_stock_level = CASE brand_name WHEN 'Band-Aid' THEN 9 WHEN 'Bethadine' THEN 2 WHEN 'Bioflu' THEN 3 WHEN 'Biogesic' THEN 38 WHEN 'Bonamine' THEN 9 WHEN 'Catapres' THEN 7 WHEN 'Dolfenal' THEN 14 WHEN 'Imodium' THEN 3 WHEN 'Kremil-S' THEN 10 WHEN 'Medicol Advance' THEN 7 WHEN 'Salonpas' THEN 4 WHEN 'Serc' THEN 3 END,
  adequate_stock_level = CASE brand_name WHEN 'Band-Aid' THEN 34 WHEN 'Bethadine' THEN 8 WHEN 'Bioflu' THEN 10 WHEN 'Biogesic' THEN 150 WHEN 'Bonamine' THEN 36 WHEN 'Catapres' THEN 26 WHEN 'Dolfenal' THEN 56 WHEN 'Imodium' THEN 12 WHEN 'Kremil-S' THEN 38 WHEN 'Medicol Advance' THEN 26 WHEN 'Salonpas' THEN 14 WHEN 'Serc' THEN 12 END
WHERE brand_name IN ('Band-Aid','Bethadine','Bioflu','Biogesic','Bonamine','Catapres','Dolfenal','Imodium','Kremil-S','Medicol Advance','Salonpas','Serc');
