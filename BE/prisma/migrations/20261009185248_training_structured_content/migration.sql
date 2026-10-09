-- Revisi detail pelatihan: konten terstruktur (divalidasi Zod di BE) menggantikan rich text.
-- Data lama tidak dikonversi (keputusan pemilik produk): `body` di-rename menjadi `description`
-- (format rich text sama), kolom lama lainnya di-drop/di-reset. Belum ada data produksi.

-- body -> description (isi rich text dipertahankan).
ALTER TABLE "Training" RENAME COLUMN "body" TO "description";

-- objectives/syllabus diganti outcomes/modules.
ALTER TABLE "Training" DROP COLUMN "objectives",
DROP COLUMN "syllabus",
ADD COLUMN     "faq" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "modules" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "outcomes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "prerequisites" TEXT;

-- audience: rich text -> { role, note? }[]; facilities: rich text -> string[] | null (null = default global).
UPDATE "Training" SET "audience" = '[]'::jsonb, "facilities" = NULL;
ALTER TABLE "Training" ALTER COLUMN "audience" SET NOT NULL,
ALTER COLUMN "audience" SET DEFAULT '[]';

-- ===== Search: judul modul materi ikut dengan bobot D =====

-- Fungsi lama (3 argumen) digantikan versi dengan modul.
DROP FUNCTION IF EXISTS training_search_vector(uuid, text, text);

CREATE OR REPLACE FUNCTION training_search_vector(training_id uuid, title text, summary text, modules jsonb)
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
      setweight(to_tsvector('public.simple_unaccent', coalesce(summary, '')), 'C') ||
      setweight(to_tsvector('public.simple_unaccent', coalesce((
        SELECT string_agg(module ->> 'title', ' ')
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(modules) = 'array' THEN modules ELSE '[]'::jsonb END) AS module
      ), '')), 'D')
  $$;

CREATE OR REPLACE FUNCTION training_search_before_write() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    NEW."searchTitle" := lower(immutable_unaccent(coalesce(NEW."title", '')));
    NEW."searchVector" := training_search_vector(NEW."id", NEW."title", NEW."summary", NEW."modules");
    RETURN NEW;
  END
  $$;

DROP TRIGGER IF EXISTS training_search_before_write ON "Training";
CREATE TRIGGER training_search_before_write
  BEFORE INSERT OR UPDATE OF "title", "summary", "modules" ON "Training"
  FOR EACH ROW EXECUTE FUNCTION training_search_before_write();

CREATE OR REPLACE FUNCTION training_search_after_category_link() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  DECLARE
    affected uuid;
  BEGIN
    affected := CASE WHEN TG_OP = 'DELETE' THEN OLD."trainingId" ELSE NEW."trainingId" END;
    UPDATE "Training" t
      SET "searchVector" = training_search_vector(t."id", t."title", t."summary", t."modules")
      WHERE t."id" = affected;
    IF TG_OP = 'UPDATE' AND OLD."trainingId" <> NEW."trainingId" THEN
      UPDATE "Training" t
        SET "searchVector" = training_search_vector(t."id", t."title", t."summary", t."modules")
        WHERE t."id" = OLD."trainingId";
    END IF;
    RETURN NULL;
  END
  $$;

CREATE OR REPLACE FUNCTION training_search_after_category_change() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    UPDATE "Training" t
      SET "searchVector" = training_search_vector(t."id", t."title", t."summary", t."modules")
      FROM "TrainingCategory" tc
      WHERE tc."categoryId" = NEW."id" AND tc."trainingId" = t."id";
    RETURN NULL;
  END
  $$;

-- Hitung ulang kolom pencarian semua baris.
UPDATE "Training" SET "title" = "title";
