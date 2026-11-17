ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_kind_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_kind_check CHECK(kind IN ('hero','gallery'));
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS caption text NOT NULL DEFAULT '';
