import { ImageResponse } from "next/og";
import { getSettings } from "@/lib/api/public";
import { monogramInitial } from "@/lib/monogram";

// Favicon cadangan: monogram monokrom (huruf pertama nama situs) selama favicon di CMS kosong.
// Dipasang lewat metadata `icons` di root layout & layout publik, bukan konvensi file app/icon.*,
// karena ikon berbasis file selalu menimpa favicon dari CMS.
// ImageResponse tidak membaca CSS variables, jadi nilai token DESIGN.md ditulis langsung di sini.
const FG_STRONG = "#0A0A0A"; // --fg-strong
const INVERSE_FG = "#FAFAFA"; // --inverse-fg
const SIZE = 64;

async function siteInitial(): Promise<string> {
  try {
    return monogramInitial((await getSettings()).identity.name);
  } catch {
    // BE tidak terjangkau (mis. saat build): kotak polos tanpa huruf.
    return "";
  }
}

export async function GET() {
  const initial = await siteInitial();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: FG_STRONG,
          color: INVERSE_FG,
          borderRadius: 12,
          fontSize: 40,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        {initial}
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
