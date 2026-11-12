-- ZELVORA migration 002: optional persistent sessions
--
-- Needed only when ZELVORA_SESSION_STORE=db. Local development keeps memory
-- sessions and does not require this table.
--
-- Preferred, idempotent route:
--
--     cd backend
--     python migrate_db.py
--
-- The Python migration checks information_schema first and does nothing when
-- the table already exists. This SQL file is kept as a manual reference.

CREATE TABLE IF NOT EXISTS sessions (
  token_hash     CHAR(64) NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  expires_at     DOUBLE NOT NULL,
  password_stamp CHAR(64) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_expires (expires_at),
  KEY idx_sessions_user (user_id)
) ENGINE=InnoDB;
