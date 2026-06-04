CREATE TABLE IF NOT EXISTS supply_proposals (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_user_id INT UNSIGNED NOT NULL,
  buyer_demand_id INT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  price_offer VARCHAR(120) NULL,
  volume_offer VARCHAR(120) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_proposal_seller_demand (seller_user_id, buyer_demand_id),
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_demand_id) REFERENCES buyer_demands(id) ON DELETE CASCADE,
  INDEX idx_proposals_seller (seller_user_id),
  INDEX idx_proposals_demand (buyer_demand_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
