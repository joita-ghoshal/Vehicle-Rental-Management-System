-- ZELVORA - Vehicle Rental Management System
-- Database schema (MySQL 8.0 or newer)
-- Run this file once to create the database and its three tables.

CREATE DATABASE IF NOT EXISTS zelvora_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE zelvora_db;

-- 1) Users: customers and admins ------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  phone         VARCHAR(20)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- 2) Vehicles ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                VARCHAR(100) NOT NULL,
  brand               VARCHAR(60)  NOT NULL,
  model               VARCHAR(60)  NOT NULL,
  category            ENUM('Car', 'Bike', 'Scooter') NOT NULL,
  registration_number VARCHAR(30)  NOT NULL,
  fuel_type           ENUM('Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid') NOT NULL,
  transmission        ENUM('Manual', 'Automatic', 'Not applicable') NOT NULL DEFAULT 'Not applicable',
  seats               TINYINT UNSIGNED NOT NULL,
  price_per_day       DECIMAL(10,2) NOT NULL,
  image_url           VARCHAR(500) NOT NULL,
  description         TEXT NOT NULL,
  status              ENUM('Active', 'Inactive', 'Maintenance') NOT NULL DEFAULT 'Active',
  is_archived         TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_registration (registration_number),
  KEY idx_vehicles_category (category),
  CONSTRAINT chk_vehicles_seats CHECK (seats BETWEEN 1 AND 12),
  CONSTRAINT chk_vehicles_price CHECK (price_per_day > 0)
) ENGINE=InnoDB;

-- 3) Bookings ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  vehicle_id     INT UNSIGNED NOT NULL,
  pickup_date    DATE NOT NULL,
  return_date    DATE NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL,
  booking_status ENUM('Pending', 'Confirmed', 'Rejected', 'Cancelled', 'Completed') NOT NULL DEFAULT 'Pending',
  payment_status ENUM('Unpaid', 'Paid') NOT NULL DEFAULT 'Unpaid',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bookings_user (user_id),
  KEY idx_bookings_vehicle_dates (vehicle_id, booking_status, pickup_date, return_date),
  CONSTRAINT fk_bookings_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles (id) ON DELETE RESTRICT,
  CONSTRAINT chk_bookings_dates  CHECK (return_date >= pickup_date),
  CONSTRAINT chk_bookings_amount CHECK (total_amount >= 0)
) ENGINE=InnoDB;
