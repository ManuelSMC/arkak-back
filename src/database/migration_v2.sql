-- Migration V2: Seller Requests + Must Change Password
-- Note: DATABASE is already selected via DB_NAME env var in the connection pool.

-- Add must_change_password column to users
ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER reset_password_expires;

-- Seller requests table
CREATE TABLE IF NOT EXISTS seller_requests (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  phone       VARCHAR(20),
  bio         TEXT,
  years_experience INT,
  message     TEXT,
  status      ENUM('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
  reviewed_by INT,
  reviewed_at DATETIME,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_seller_requests_status ON seller_requests(status);
CREATE INDEX idx_seller_requests_email ON seller_requests(email);
