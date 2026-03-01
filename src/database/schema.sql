-- ============================================
-- ArkaK - Real Estate Platform Database Schema
-- MySQL 8.x
-- ============================================
-- Note: DATABASE is already selected via DB_NAME env var in the connection pool.

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  phone       VARCHAR(20),
  avatar_url  VARCHAR(500),
  role        ENUM('admin','vendedor','cliente') NOT NULL DEFAULT 'cliente',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  verification_token VARCHAR(255),
  reset_password_token VARCHAR(255),
  reset_password_expires DATETIME,
  -- Seller-specific profile fields
  bio             TEXT,
  years_experience INT,
  rating          DECIMAL(2,1) DEFAULT 0.0,
  rating_count    INT DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- PROPERTIES
-- ============================================
CREATE TABLE properties (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  seller_id           INT NOT NULL,
  title               VARCHAR(255) NOT NULL,
  description         TEXT NOT NULL,
  price               DECIMAL(14,2) NOT NULL,
  operation_type      ENUM('venta','renta') NOT NULL,
  property_type       ENUM('casa','departamento','terreno','local_comercial') NOT NULL,
  -- Address
  street              VARCHAR(255),
  neighborhood        VARCHAR(255),
  city                VARCHAR(150),
  state               VARCHAR(100),
  zip_code            VARCHAR(10),
  latitude            DECIMAL(10,8),
  longitude           DECIMAL(11,8),
  -- Specs
  total_area          DECIMAL(10,2),
  built_area          DECIMAL(10,2),
  bedrooms            INT DEFAULT 0,
  bathrooms           INT DEFAULT 0,
  half_bathrooms      INT DEFAULT 0,
  parking_spaces      INT DEFAULT 0,
  year_built          INT,
  -- Features (booleans as TINYINT)
  has_garden          TINYINT(1) DEFAULT 0,
  has_pool            TINYINT(1) DEFAULT 0,
  has_storage         TINYINT(1) DEFAULT 0,
  has_security        TINYINT(1) DEFAULT 0,
  is_furnished        TINYINT(1) DEFAULT 0,
  -- Status & metrics
  status              ENUM('activa','pausada','vendida') NOT NULL DEFAULT 'activa',
  is_featured         TINYINT(1) DEFAULT 0,
  view_count          INT DEFAULT 0,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Full-text index for search
ALTER TABLE properties ADD FULLTEXT idx_ft_search (title, description, neighborhood, city);

-- ============================================
-- PROPERTY IMAGES
-- ============================================
CREATE TABLE property_images (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  image_url   VARCHAR(500) NOT NULL,
  sort_order  INT DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- SELLER SCHEDULES (weekly availability)
-- ============================================
CREATE TABLE seller_schedules (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  seller_id   INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '0=Sun,1=Mon,...,6=Sat',
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  slot_duration INT NOT NULL DEFAULT 30 COMMENT 'minutes: 30, 45 or 60',
  UNIQUE KEY uk_seller_day (seller_id, day_of_week),
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- BLOCKED SLOTS (manual blocks by seller)
-- ============================================
CREATE TABLE blocked_slots (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  seller_id   INT NOT NULL,
  blocked_date DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  reason      VARCHAR(255),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE appointments (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  property_id     INT NOT NULL,
  client_id       INT NOT NULL,
  seller_id       INT NOT NULL,
  appointment_date DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  status          ENUM('confirmada','cancelada','completada') NOT NULL DEFAULT 'confirmada',
  notes           TEXT,
  cancelled_by    ENUM('cliente','vendedor','admin'),
  cancelled_at    DATETIME,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Prevent double booking
  UNIQUE KEY uk_seller_slot (seller_id, appointment_date, start_time),
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id)   REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- FAVORITES
-- ============================================
CREATE TABLE favorites (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  property_id INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_property (user_id, property_id),
  FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     TEXT NOT NULL,
  type        ENUM('cita','propiedad','sistema') NOT NULL DEFAULT 'sistema',
  is_read     TINYINT(1) DEFAULT 0,
  link        VARCHAR(500),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_properties_seller   ON properties(seller_id);
CREATE INDEX idx_properties_status   ON properties(status);
CREATE INDEX idx_properties_type     ON properties(property_type, operation_type);
CREATE INDEX idx_properties_price    ON properties(price);
CREATE INDEX idx_appointments_date   ON appointments(appointment_date);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_seller ON appointments(seller_id);
CREATE INDEX idx_notifications_user  ON notifications(user_id, is_read);
