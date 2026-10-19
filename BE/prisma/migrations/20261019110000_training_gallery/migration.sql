-- Galeri foto pelatihan: array mediaId (string[]) di kolom JSONB.
ALTER TABLE "Training" ADD COLUMN IF NOT EXISTS "gallery" JSONB NOT NULL DEFAULT '[]';
