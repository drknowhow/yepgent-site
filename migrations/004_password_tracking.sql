-- Track when a user sets a password for the first time (after magic-link signup)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password_set_at timestamptz;
