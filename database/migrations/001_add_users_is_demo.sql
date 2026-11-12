-- ZELVORA migration 001: add users.is_demo
--
-- Run this once against an existing zelvora_db database. New installations
-- created from database/database.sql already include the column.
--
-- MySQL 8.0 has no "ADD COLUMN IF NOT EXISTS", so the preferred, safe route is:
--
--     cd backend
--     python migrate_db.py
--
-- The Python migration checks information_schema first and does nothing when
-- the column already exists. This SQL file is kept as a manual reference.

USE zelvora_db;

ALTER TABLE users
  ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER role;

-- Demo accounts are identified by this flag and can be restricted by the API.
