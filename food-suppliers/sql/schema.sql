CREATE DATABASE IF NOT EXISTS foodsource
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE foodsource;

SET NAMES utf8mb4;

CREATE TABLE categories (
  id VARCHAR(32) NOT NULL,
  label VARCHAR(120) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE regions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_regions_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  audience ENUM('buyer', 'seller') NOT NULL DEFAULT 'buyer',
  organization_name VARCHAR(200) NULL,
  city VARCHAR(120) NULL,
  region VARCHAR(120) NULL,
  contact_phone VARCHAR(40) NULL,
  contact_email VARCHAR(120) NULL,
  supplier_id VARCHAR(64) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE suppliers (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  city VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  rating DECIMAL(2, 1) NOT NULL DEFAULT 0,
  reviews_count INT UNSIGNED NOT NULL DEFAULT 0,
  min_order VARCHAR(120) NOT NULL,
  min_order_kg INT UNSIGNED NULL,
  price_hint VARCHAR(200) NULL,
  has_certificates TINYINT(1) NOT NULL DEFAULT 0,
  delivery TEXT NOT NULL,
  source VARCHAR(200) NOT NULL,
  response_time VARCHAR(80) NOT NULL,
  working_hours VARCHAR(40) NOT NULL DEFAULT '08:00–21:00 (МСК)',
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(120) NOT NULL,
  website VARCHAR(255) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE supplier_categories (
  supplier_id VARCHAR(64) NOT NULL,
  category_id VARCHAR(32) NOT NULL,
  PRIMARY KEY (supplier_id, category_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE supplier_regions (
  supplier_id VARCHAR(64) NOT NULL,
  region_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (supplier_id, region_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE certificates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category_id VARCHAR(32) NULL,
  description TEXT NULL,
  price_hint VARCHAR(120) NULL,
  price_per_unit DECIMAL(10, 2) NULL,
  min_order VARCHAR(80) NULL,
  unit VARCHAR(40) NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_products_supplier (supplier_id),
  INDEX idx_products_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE buyer_demands (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  company_name VARCHAR(200) NOT NULL,
  city VARCHAR(120) NOT NULL,
  region VARCHAR(120) NOT NULL,
  business_type VARCHAR(120) NOT NULL,
  category_id VARCHAR(32) NULL,
  volume_text VARCHAR(120) NOT NULL,
  volume_kg INT UNSIGNED NULL,
  budget_text VARCHAR(120) NULL,
  description TEXT NOT NULL,
  contact_phone VARCHAR(40) NOT NULL,
  contact_email VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_buyer_demands_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE favorites (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  target_type ENUM('supplier', 'buyer_demand') NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_favorites_user_target (user_id, target_type, target_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_favorites_user_type (user_id, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE supply_proposals (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_user_id INT UNSIGNED NOT NULL,
  buyer_demand_id INT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  price_offer VARCHAR(120) NULL,
  volume_offer VARCHAR(120) NULL,
  line_items JSON NULL,
  offer_total DECIMAL(12, 2) NULL,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_proposal_seller_demand (seller_user_id, buyer_demand_id),
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (buyer_demand_id) REFERENCES buyer_demands(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  supplier_id VARCHAR(64) NOT NULL,
  status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_supplier (supplier_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(200) NOT NULL,
  unit VARCHAR(40) NOT NULL DEFAULT 'шт.',
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
