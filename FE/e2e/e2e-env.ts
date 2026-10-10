// Server khusus e2e: port sendiri dan database training_e2e (BE/scripts/e2e-dev.ts), terpisah dari
// `npm run dev` (3000/4000, training_dev). Port BE harus sama dengan BE/scripts/e2e-shared.ts.
export const E2E_FE_ORIGIN = "http://localhost:3100";
export const E2E_BE_ORIGIN = "http://localhost:4100";
