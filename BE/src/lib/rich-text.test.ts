import { describe, expect, it } from "vitest";
import {
  isAllowedHref,
  optionalRichTextSchema,
  renderRichText,
  richTextSchema,
  richTextToPlain,
} from "@/lib/rich-text";

const text = (value: string, marks?: object[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const p = (...content: object[]) => ({ type: "paragraph", content });
const doc = (...content: object[]) => ({ type: "doc", content });
const link = (href: string) => ({ type: "link", attrs: { href } });

describe("richTextSchema (allowlist)", () => {
  it("menerima semua node & mark yang diizinkan", () => {
    const value = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Judul")] },
      { type: "heading", attrs: { level: 3 }, content: [text("Sub")] },
      p(text("tebal", [{ type: "bold" }]), text(" miring", [{ type: "italic" }]), { type: "hardBreak" }),
      p(text("situs", [link("https://example.com")]), text(" surel", [link("mailto:a@b.co")])),
      p(text("telepon", [link("tel:+6221000")])),
      { type: "bulletList", content: [{ type: "listItem", content: [p(text("satu"))] }] },
      {
        type: "orderedList",
        attrs: { start: 3 },
        content: [{ type: "listItem", content: [p(text("tiga"))] }],
      },
      { type: "blockquote", content: [p(text("kutipan"))] },
    );
    expect(richTextSchema.safeParse(value).success).toBe(true);
  });

  it.each([
    ["node gambar", doc({ type: "image", attrs: { src: "https://x/y.png" } })],
    ["code block", doc({ type: "codeBlock", content: [text("x")] })],
    ["heading level 1", doc({ type: "heading", attrs: { level: 1 }, content: [text("x")] })],
    ["mark tidak dikenal", doc(p(text("x", [{ type: "strike" }])))],
    ["link javascript:", doc(p(text("x", [link("javascript:alert(1)")])))],
    ["link JaVaScRiPt: + spasi", doc(p(text("x", [link("  JaVaScRiPt:alert(1)")])))],
    ["link data:", doc(p(text("x", [link("data:text/html;base64,PHNjcmlwdD4=")])))],
    ["link relatif", doc(p(text("x", [link("/admin")])))],
    ["link protocol-relative", doc(p(text("x", [link("//evil.example")])))],
    ["root bukan doc", p(text("x"))],
  ])("menolak %s", (_label, value) => {
    expect(richTextSchema.safeParse(value).success).toBe(false);
  });

  it("membuang atribut yang tidak dikenal", () => {
    const parsed = richTextSchema.parse(
      doc({
        type: "paragraph",
        attrs: { style: "color:red", onclick: "x()" },
        content: [text("x", [{ type: "link", attrs: { href: "https://a.co", onclick: "x()", class: "y" } }])],
      }),
    );
    expect(JSON.stringify(parsed)).not.toMatch(/onclick|style|class/);
  });

  it("dokumen kosong disimpan sebagai null", () => {
    expect(optionalRichTextSchema.parse(doc(p()))).toBeNull();
    expect(optionalRichTextSchema.parse(null)).toBeNull();
    expect(optionalRichTextSchema.parse(undefined)).toBeUndefined();
  });
});

describe("isAllowedHref", () => {
  it.each([
    ["https://example.com/a?b=c", true],
    ["http://example.com", true],
    ["mailto:halo@example.com", true],
    ["tel:+62812", true],
    ["ftp://example.com", false],
    ["vbscript:msgbox", false],
    ["https://", false],
  ])("%s -> %s", (href, expected) => {
    expect(isAllowedHref(href)).toBe(expected);
  });
});

describe("renderRichText", () => {
  it("merender HTML dengan escape teks dan atribut", () => {
    const html = renderRichText(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("<b>Judul</b>")] },
        p(text("a & b", [{ type: "bold" }, { type: "italic" }])),
        p(text("klik", [link('https://a.co/?q="x"')])),
        p(text("surel", [link("mailto:a@b.co")])),
      ),
    );
    expect(html).toBe(
      "<h2>&lt;b&gt;Judul&lt;/b&gt;</h2>" +
        "<p><strong><em>a &amp; b</em></strong></p>" +
        '<p><a href="https://a.co/?q=&quot;x&quot;" target="_blank" rel="noopener noreferrer nofollow">klik</a></p>' +
        '<p><a href="mailto:a@b.co">surel</a></p>',
    );
  });

  it("merender list dan blockquote", () => {
    const html = renderRichText(
      doc(
        { type: "orderedList", attrs: { start: 2 }, content: [{ type: "listItem", content: [p(text("a"))] }] },
        { type: "blockquote", content: [p(text("q"))] },
      ),
    );
    expect(html).toBe('<ol start="2"><li><p>a</p></li></ol><blockquote><p>q</p></blockquote>');
  });

  it("data tidak valid di DB tidak pernah dirender mentah", () => {
    expect(renderRichText(doc({ type: "script", content: [text("alert(1)")] }))).toBeNull();
    expect(renderRichText("<script>alert(1)</script>")).toBeNull();
    expect(renderRichText(null)).toBeNull();
  });

  it("richTextToPlain menggabungkan teks", () => {
    expect(
      richTextToPlain(
        richTextSchema.parse(
          doc(p(text("Satu")), { type: "bulletList", content: [{ type: "listItem", content: [p(text("dua"))] }] }),
        ),
      ),
    ).toBe("Satu dua");
  });
});
