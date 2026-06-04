USE foodsource;
SET NAMES utf8mb4;

INSERT INTO users (username, password_hash, role) VALUES
  ('admin1', '$2b$10$YI5epgxlW3afYHzHOk10Cum0D.8byJDoa5nGt4AQVVRC1go75QT..', 'admin'),
  ('user1', '$2b$10$zhvynBN9CTwcFBjgYNQo7eKt1nVGRUOlD2WbEGBSdoz96vZ40WW0O', 'user')
ON DUPLICATE KEY UPDATE username = username;
