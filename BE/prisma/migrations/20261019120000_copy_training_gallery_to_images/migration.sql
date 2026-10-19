-- Dua galeri pelatihan bertemu saat merge: tabel TrainingImage (editor admin) dan kolom JSONB
-- Training.gallery (migrasi 20261019110000). TrainingImage yang dipakai; isi kolom gallery disalin ke
-- sana supaya foto yang sudah terpasang tetap tampil. Additive: hanya pelatihan yang galeri
-- TrainingImage-nya masih kosong, maks 6 foto (batas validator), media di Sampah atau tidak ada dilewati.
-- Kolom gallery tidak dihapus di sini.
INSERT INTO "TrainingImage" ("trainingId", "mediaId", "order")
SELECT t."id", m."id", (g.ord - 1)::int
FROM "Training" t
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(t."gallery") = 'array' THEN t."gallery" ELSE '[]'::jsonb END
) WITH ORDINALITY AS g(media_id, ord)
JOIN "Media" m ON m."id"::text = g.media_id AND m."deletedAt" IS NULL
WHERE g.ord <= 6
  AND NOT EXISTS (SELECT 1 FROM "TrainingImage" ti WHERE ti."trainingId" = t."id")
ON CONFLICT ("trainingId", "mediaId") DO NOTHING;
