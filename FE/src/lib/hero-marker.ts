// Penanda hero bergambar di bagian paling atas halaman (beranda, DESIGN.md 8.1). Elemen dengan atribut
// ini membuat header tampil transparan di atasnya (public.css, tanpa JS) dan floating contact baru
// muncul setelah hero lewat (HeroSlideshow menandai html[data-past-hero]).
export const HEADER_OVER_ATTR = "data-header-over";
export const PAST_HERO_ATTR = "data-past-hero";
// cacheComponents menyimpan halaman yang ditinggalkan di <Activity mode="hidden"> (display: none), jadi
// penanda hero tetap ada di DOM halaman lain. HeroSlideshow menandai html[data-hero-hidden] selama hero
// tersembunyi supaya aturan di atas tidak berlaku.
export const HERO_HIDDEN_ATTR = "data-hero-hidden";
