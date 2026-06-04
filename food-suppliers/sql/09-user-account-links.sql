ALTER TABLE users
  ADD COLUMN supplier_id VARCHAR(64) NULL AFTER contact_email,
  ADD CONSTRAINT fk_users_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

ALTER TABLE buyer_demands
  ADD COLUMN user_id INT UNSIGNED NULL AFTER id,
  ADD INDEX idx_buyer_demands_user (user_id),
  ADD CONSTRAINT fk_buyer_demands_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
