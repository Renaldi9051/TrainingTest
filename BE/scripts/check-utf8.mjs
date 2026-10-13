// Cek encoding: semua file teks yang dilacak git di folder ini harus UTF-8 valid dan tanpa U+FFFD
// (karakter pengganti, tanda konversi encoding yang rusak). Dipanggil dari `npm run check`.
// Tanpa dependency; sama persis dengan FE/scripts/check-utf8.mjs.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|css|json|sql|prisma|md|yaml|yml|html|csv|svg)$/i;
const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "."], { encoding: "utf8" })
  .split("\0")
  .filter((file) => file && EXTENSIONS.test(file));

const decoder = new TextDecoder("utf-8", { fatal: true });
const problems = [];
for (const file of files) {
  let text;
  try {
    text = decoder.decode(readFileSync(file));
  } catch (error) {
    if (error && error.code === "ENOENT") continue;
    problems.push(`${file}: bukan UTF-8 valid`);
    continue;
  }
  const index = text.indexOf("\uFFFD");
  if (index !== -1) {
    const line = text.slice(0, index).split("\n").length;
    problems.push(`${file}:${line}: berisi U+FFFD (karakter rusak)`);
  }
}

if (problems.length > 0) {
  console.error(`Cek UTF-8 gagal (${problems.length} file):\n${problems.map((problem) => `  ${problem}`).join("\n")}`);
  process.exit(1);
}
console.info(`Cek UTF-8: ${files.length} file OK.`);
