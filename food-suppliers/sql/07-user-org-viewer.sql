-- Организация при регистрации + тип «наблюдатель»
ALTER TABLE users
  MODIFY COLUMN audience ENUM('buyer', 'seller', 'viewer') NOT NULL DEFAULT 'buyer';

ALTER TABLE users
  ADD COLUMN organization_name VARCHAR(200) NULL AFTER audience,
  ADD COLUMN city VARCHAR(120) NULL AFTER organization_name,
  ADD COLUMN region VARCHAR(120) NULL AFTER city,
  ADD COLUMN contact_phone VARCHAR(40) NULL AFTER region,
  ADD COLUMN contact_email VARCHAR(120) NULL AFTER contact_phone;
