CREATE INDEX export_jobs_queued_created
  ON export_jobs(created_at)
  WHERE status = 'queued';

CREATE INDEX export_jobs_ready_expiry
  ON export_jobs(expires_at)
  WHERE status = 'ready' AND bucket_key IS NOT NULL;
