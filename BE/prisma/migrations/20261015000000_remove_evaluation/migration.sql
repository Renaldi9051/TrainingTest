-- Fitur Evaluasi tidak digunakan. Jangan menghapus jawaban peserta secara diam-diam
-- bila migrasi ini dijalankan pada database lain yang ternyata sudah berisi data.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "EvaluationResponse" LIMIT 1)
     OR EXISTS (SELECT 1 FROM "EvaluationQuestion" LIMIT 1) THEN
    RAISE EXCEPTION 'Tabel Evaluasi masih berisi data; tinjau dan arsipkan sebelum migrasi.';
  END IF;
END $$;

DROP TABLE "EvaluationResponse";
DROP TABLE "EvaluationQuestion";
DROP TYPE "EvaluationQuestionType";
