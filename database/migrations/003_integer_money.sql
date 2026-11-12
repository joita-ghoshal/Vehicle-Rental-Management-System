-- ZELVORA migration 003: whole-rupee money columns
--
-- Converts the two monetary columns from DECIMAL(10,2) to INT UNSIGNED so the
-- application never stores or calculates money as a floating-point value.
-- Existing rows are kept; any legacy fractional paise are rounded to the
-- nearest rupee before the type change.
--
-- Preferred, idempotent route:
--
--     cd backend
--     python migrate_db.py
--
-- The Python migration checks information_schema first and does nothing when
-- the columns are already integers. This SQL file is a manual reference.

USE zelvora_db;

UPDATE vehicles SET price_per_day = ROUND(price_per_day);
UPDATE bookings SET total_amount = ROUND(total_amount);

ALTER TABLE vehicles MODIFY price_per_day INT UNSIGNED NOT NULL;
ALTER TABLE bookings MODIFY total_amount INT UNSIGNED NOT NULL;
