import { NextResponse } from "next/server";

// Redirect ke path internal dengan Location relatif. Jangan membentuk URL absolut dari request.url di
// route handler: di container Next berjalan dengan HOSTNAME=0.0.0.0 sehingga request.url menjadi
// http://0.0.0.0:3000/... dan browser tidak bisa membukanya. Path relatif selalu ikut origin browser
// (localhost, domain produksi, atau di balik proxy). Cookie dari cookies()/draftMode() tetap terpasang.
export function localRedirect(path: string, status: 303 | 307 = 307): NextResponse {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error(`Bukan path internal: ${path}`);
  return new NextResponse(null, { status, headers: { Location: path } });
}
