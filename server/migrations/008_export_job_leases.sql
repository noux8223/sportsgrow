ALTER TABLE export_jobs DROP CONSTRAINT export_jobs_status_check;
ALTER TABLE export_jobs ADD CONSTRAINT export_jobs_status_check
  CHECK (status IN ('queued','processing','ready','expired','failed'));
ALTER TABLE export_jobs ADD COLUMN processing_token uuid;
ALTER TABLE export_jobs ADD COLUMN processing_started_at timestamptz;
CREATE INDEX export_jobs_processing_lease
  ON export_jobs(processing_started_at)
  WHERE status='processing';
