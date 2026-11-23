-- Minimum hours before the same medicine can be released to the same student again.
-- Run after migration_medicine_dose_interval.sql. Idempotent. Matches by brand name.
-- Left NULL (no fixed gap): Alcohol, Band-Aid, Bethadine, Katinko Spray (external, as needed),
-- Imodium (after each loose stool), Kremil-S (after meals / bedtime).
UPDATE medicines SET min_hours_between_doses = 8  WHERE brand_name = 'Serc';
UPDATE medicines SET min_hours_between_doses = 8  WHERE brand_name = 'Salonpas';
UPDATE medicines SET min_hours_between_doses = 24 WHERE brand_name = 'Bonamine';
UPDATE medicines SET min_hours_between_doses = 8  WHERE brand_name = 'Dolfenal';
UPDATE medicines SET min_hours_between_doses = 4  WHERE brand_name = 'Biogesic';
UPDATE medicines SET min_hours_between_doses = 4  WHERE brand_name = 'Medicol Advance';
UPDATE medicines SET min_hours_between_doses = 6  WHERE brand_name = 'Bioflu';
UPDATE medicines SET min_hours_between_doses = 6  WHERE brand_name = 'Catapres';
-- Every tablet / capsule needs a gap. Imodium and Kremil-S have no fixed interval on the label: 4 hours assumed, change in Medicine Inventory.
UPDATE medicines SET min_hours_between_doses = 4 WHERE brand_name IN ('Imodium', 'Kremil-S') AND min_hours_between_doses IS NULL;
