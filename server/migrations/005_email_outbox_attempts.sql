ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0;
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS last_error text;
