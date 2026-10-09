-- Fase 2: pencarian katalog pelatihan (PRD 5.5, target p95 < 300 ms untuk 1.000+ judul).
--
-- Kolom & index tercatat di schema.prisma (Training.searchVector, Training.searchTitle), jadi
-- `migrate dev` berikutnya tidak menghapusnya. Ekstensi, text search config, fungsi, dan trigger
-- di bawah tidak dikelola Prisma (tidak ikut di-diff) dan hanya dibuat di migrasi ini.

-- Ekstensi "trusted": cukup pemilik database, tidak perlu superuser.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent() bawaan tidak IMMUTABLE; pembungkus dengan kamus eksplisit supaya hasilnya stabil.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

-- Config `simple` (tanpa stemming bahasa tertentu) + buang diakritik.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'simple_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION public.simple_unaccent (COPY = pg_catalog.simple);
    ALTER TEXT SEARCH CONFIGURATION public.simple_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH public.unaccent, pg_catalog.simple;
  END IF;
END
$$;

-- AlterTable
ALTER TABLE "Training" ADD COLUMN     "publishRevalidatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "searchTitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "searchVector" tsvector;

-- CreateIndex
CREATE INDEX "Schedule_city_idx" ON "Schedule"("city");

-- CreateIndex
CREATE INDEX "Training_status_publishedAt_idx" ON "Training"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Training_searchVector_idx" ON "Training" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "Training_searchTitle_idx" ON "Training" USING GIN ("searchTitle" gin_trgm_ops);

-- ===== Pengisian kolom pencarian =====

-- Vektor: judul (A), nama kategori aktif (B), ringkasan (C).
CREATE OR REPLACE FUNCTION training_search_vector(training_id uuid, title text, summary text)
  RETURNS tsvector
  LANGUAGE sql STABLE
  AS $$
    SELECT
      setweight(to_tsvector('public.simple_unaccent', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('public.simple_unaccent', coalesce((
        SELECT string_agg(c."name", ' ')
        FROM "TrainingCategory" tc
        JOIN "Category" c ON c."id" = tc."categoryId"
        WHERE tc."trainingId" = training_id AND c."deletedAt" IS NULL
      ), '')), 'B') ||
      setweight(to_tsvector('public.simple_unaccent', coalesce(summary, '')), 'C')
  $$;

-- Judul/ringkasan berubah: hitung ulang di baris yang sama (BEFORE, tanpa UPDATE tambahan).
CREATE OR REPLACE FUNCTION training_search_before_write() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    NEW."searchTitle" := lower(immutable_unaccent(coalesce(NEW."title", '')));
    NEW."searchVector" := training_search_vector(NEW."id", NEW."title", NEW."summary");
    RETURN NEW;
  END
  $$;

CREATE TRIGGER training_search_before_write
  BEFORE INSERT OR UPDATE OF "title", "summary" ON "Training"
  FOR EACH ROW EXECUTE FUNCTION training_search_before_write();

-- Kategori pelatihan ditambah/dilepas: hitung ulang vektor pelatihan itu.
-- UPDATE di sini tidak menyentuh title/summary, jadi trigger di atas tidak ikut jalan.
CREATE OR REPLACE FUNCTION training_search_after_category_link() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    affected uuid;
  BEGIN
    affected := CASE WHEN TG_OP = 'DELETE' THEN OLD."trainingId" ELSE NEW."trainingId" END;
    UPDATE "Training" t
      SET "searchVector" = training_search_vector(t."id", t."title", t."summary")
      WHERE t."id" = affected;
    IF TG_OP = 'UPDATE' AND OLD."trainingId" <> NEW."trainingId" THEN
      UPDATE "Training" t
        SET "searchVector" = training_search_vector(t."id", t."title", t."summary")
        WHERE t."id" = OLD."trainingId";
    END IF;
    RETURN NULL;
  END
  $$;

CREATE TRIGGER training_search_after_category_link
  AFTER INSERT OR UPDATE OR DELETE ON "TrainingCategory"
  FOR EACH ROW EXECUTE FUNCTION training_search_after_category_link();

-- Nama kategori berubah atau kategori dihapus/dipulihkan: hitung ulang semua pelatihannya.
CREATE OR REPLACE FUNCTION training_search_after_category_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    UPDATE "Training" t
      SET "searchVector" = training_search_vector(t."id", t."title", t."summary")
      FROM "TrainingCategory" tc
      WHERE tc."categoryId" = NEW."id" AND tc."trainingId" = t."id";
    RETURN NULL;
  END
  $$;

CREATE TRIGGER training_search_after_category_change
  AFTER UPDATE OF "name", "deletedAt" ON "Category"
  FOR EACH ROW
  WHEN (OLD."name" IS DISTINCT FROM NEW."name" OR OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt")
  EXECUTE FUNCTION training_search_after_category_change();

-- Isi kolom pencarian untuk data yang sudah ada.
UPDATE "Training" SET "title" = "title";
