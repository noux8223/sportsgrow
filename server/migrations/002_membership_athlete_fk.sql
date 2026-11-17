DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='memberships_athlete_fk') THEN
    ALTER TABLE memberships ADD CONSTRAINT memberships_athlete_fk FOREIGN KEY(athlete_id) REFERENCES athletes ON DELETE CASCADE;
  END IF;
END $$;
