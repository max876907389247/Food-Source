USE foodsource;
SET NAMES utf8mb4;

ALTER TABLE suppliers
  ADD COLUMN working_hours VARCHAR(40) NOT NULL DEFAULT '08:00–21:00 (МСК)' AFTER response_time;
