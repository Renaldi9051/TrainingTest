import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@/lib/svg";

describe("sanitizeSvg", () => {
  it("membuang <script>, event handler, dan javascript: URL", () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
      <script>alert(document.cookie)</script>
      <rect width="10" height="10" onclick="alert(2)" fill="#000"/>
      <a href="javascript:alert(3)"><text>klik</text></a>
    </svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toBeNull();
    expect(clean).not.toMatch(/<script/i);
    expect(clean).not.toMatch(/onload|onclick/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toContain("<rect");
  });

  it("membuang foreignObject (bisa membawa HTML)", () => {
    const clean = sanitizeSvg(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="https://jahat.example"></iframe></foreignObject></svg>',
    );
    expect(clean).not.toMatch(/foreignObject|iframe/i);
  });

  it("mempertahankan namespace SVG supaya file tetap valid", () => {
    expect(sanitizeSvg("<svg><circle r='4'/></svg>")).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
    );
  });

  it("mengembalikan null kalau isinya bukan SVG", () => {
    expect(sanitizeSvg("<div>bukan svg</div>")).toBeNull();
    expect(sanitizeSvg("<script>alert(1)</script>")).toBeNull();
  });
});
