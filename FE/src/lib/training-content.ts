// Batas konten detail pelatihan. Harus sama dengan BE/src/lib/validators/training-content.ts
// (BE tetap yang memutuskan saat simpan; di sini untuk penghitung karakter & validasi form).
export const SUMMARY_MAX = 200;
export const DESCRIPTION_MAX_CHARS = 1500;
export const OUTCOMES_MIN = 4;
export const OUTCOMES_MAX = 8;
export const OUTCOME_MAX = 160;
export const MODULES_MAX = 20;
export const MODULE_TITLE_MAX = 120;
export const MODULE_POINTS_MAX = 12;
export const MODULE_POINT_MAX = 200;
export const AUDIENCE_MAX = 12;
export const AUDIENCE_ROLE_MAX = 100;
export const AUDIENCE_NOTE_MAX = 160;
export const PREREQUISITES_MAX = 300;
export const FACILITIES_MAX = 20;
export const FACILITY_MAX = 120;
export const FAQ_MAX = 20;
export const FAQ_Q_MAX = 200;
export const FAQ_A_MAX = 1000;
