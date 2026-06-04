-- Тип аккаунта: покупатель или поставщик (фиксируется при регистрации)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS audience ENUM('buyer', 'seller') NOT NULL DEFAULT 'buyer' AFTER role;
