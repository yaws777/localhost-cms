-- Stock thresholds per medicine, from the 30-day forecast (stock unit = container of the dosage form):
-- critical = 25% of forecast, low = 50%, adequate = 100%, minimum 1 / 2 / 4. Idempotent.
-- Before (critical / low / adequate): Band-Aid 9/17/34, Kremil-S 10/19/38, Bethadine 2/4/8, Serc 3/6/12,
-- Catapres 7/13/26, Alcohol 3/7/10, Medicol Advance 7/13/26, Katinko Spray 5/10/20, Imodium 3/6/12,
-- Bonamine 9/18/36, Dolfenal 14/28/56, Salonpas 4/7/14, Bioflu 3/5/10, Biogesic 38/75/150.
UPDATE medicines SET
  critical_stock_level = CASE brand_name
    WHEN 'Band-Aid' THEN 11 WHEN 'Kremil-S' THEN 7 WHEN 'Bethadine' THEN 3 WHEN 'Serc' THEN 4
    WHEN 'Catapres' THEN 5 WHEN 'Alcohol' THEN 1 WHEN 'Medicol Advance' THEN 7 WHEN 'Katinko Spray' THEN 1
    WHEN 'Imodium' THEN 6 WHEN 'Bonamine' THEN 7 WHEN 'Dolfenal' THEN 7 WHEN 'Salonpas' THEN 4
    WHEN 'Bioflu' THEN 6 WHEN 'Biogesic' THEN 15 END,
  low_stock_level = CASE brand_name
    WHEN 'Band-Aid' THEN 21 WHEN 'Kremil-S' THEN 13 WHEN 'Bethadine' THEN 5 WHEN 'Serc' THEN 7
    WHEN 'Catapres' THEN 9 WHEN 'Alcohol' THEN 2 WHEN 'Medicol Advance' THEN 13 WHEN 'Katinko Spray' THEN 2
    WHEN 'Imodium' THEN 11 WHEN 'Bonamine' THEN 13 WHEN 'Dolfenal' THEN 14 WHEN 'Salonpas' THEN 8
    WHEN 'Bioflu' THEN 12 WHEN 'Biogesic' THEN 30 END,
  adequate_stock_level = CASE brand_name
    WHEN 'Band-Aid' THEN 42 WHEN 'Kremil-S' THEN 26 WHEN 'Bethadine' THEN 9 WHEN 'Serc' THEN 14
    WHEN 'Catapres' THEN 18 WHEN 'Alcohol' THEN 4 WHEN 'Medicol Advance' THEN 26 WHEN 'Katinko Spray' THEN 4
    WHEN 'Imodium' THEN 22 WHEN 'Bonamine' THEN 25 WHEN 'Dolfenal' THEN 28 WHEN 'Salonpas' THEN 16
    WHEN 'Bioflu' THEN 23 WHEN 'Biogesic' THEN 60 END
WHERE brand_name IN ('Band-Aid','Kremil-S','Bethadine','Serc','Catapres','Alcohol','Medicol Advance','Katinko Spray',
                     'Imodium','Bonamine','Dolfenal','Salonpas','Bioflu','Biogesic');
