// Mengubah data contoh (seed-data/content.ts) menjadi input yang sudah lolos validator API, tanpa
// menyentuh database. Dipakai prisma/seed-content.ts dan scripts/sync-content-dev.ts, jadi keduanya
// tidak bisa menyimpan bentuk yang berbeda dari yang diterima admin.
import { clientCreateSchema } from "../../src/lib/validators/client";
import { homeSectionCreateSchema } from "../../src/lib/validators/home-section";
import { marketingCreateSchema } from "../../src/lib/validators/marketing";
import { mediaPartnerCreateSchema } from "../../src/lib/validators/media-partner";
import { pageBlocksSchema } from "../../src/lib/validators/page-blocks";
import { portfolioCreateSchema } from "../../src/lib/validators/portfolio";
import { serviceCreateSchema } from "../../src/lib/validators/service";
import { settingSchemas } from "../../src/lib/validators/settings";
import { testimonialCreateSchema } from "../../src/lib/validators/testimonial";
import {
  clients,
  contactSetting,
  footerSetting,
  homeSections,
  marketing,
  mediaPartners,
  paymentPage,
  portfolio,
  profilePage,
  services,
  socialSetting,
  staticPages,
  testimonials,
} from "./content";

const withIds = <T extends object>(blocks: readonly T[]) => blocks.map((block) => ({ id: crypto.randomUUID(), ...block }));

export const buildServices = () =>
  services.map((service) => ({ slug: service.slug, ...serviceCreateSchema.parse({ ...service, status: "PUBLISHED" }) }));

export const buildClients = () => clients.map((name) => clientCreateSchema.parse({ name }));

export const buildTestimonials = () => testimonials.map((item) => testimonialCreateSchema.parse(item));

export const buildPortfolio = () => portfolio.map((item) => portfolioCreateSchema.parse(item));

export const buildMarketing = () => marketing.map((item) => marketingCreateSchema.parse(item));

export const buildMediaPartners = () => mediaPartners.map((item) => mediaPartnerCreateSchema.parse(item));

export const buildProfileBlocks = () => pageBlocksSchema.parse(withIds(profilePage.blocks));

export const buildStaticPages = () =>
  staticPages.map((page) => ({
    slug: page.slug,
    title: page.title,
    blocks: pageBlocksSchema.parse([
      { id: crypto.randomUUID(), type: "RICH_TEXT", eyebrow: page.eyebrow, heading: page.heading, body: page.body },
    ]),
  }));

export const buildPaymentPage = () => ({
  slug: paymentPage.slug,
  title: paymentPage.title,
  blocks: pageBlocksSchema.parse(withIds(paymentPage.blocks)),
});

export const buildHomeSections = () => homeSections.map((section) => homeSectionCreateSchema.parse(section));

export const buildSettings = () => ({
  "site.contact": settingSchemas["site.contact"].parse(contactSetting),
  "site.social": settingSchemas["site.social"].parse(socialSetting),
  "site.footer": settingSchemas["site.footer"].parse(footerSetting),
});

// Dipanggil sekali di test: semua data contoh harus lolos validator.
export function buildAll() {
  return {
    services: buildServices(),
    clients: buildClients(),
    testimonials: buildTestimonials(),
    portfolio: buildPortfolio(),
    marketing: buildMarketing(),
    mediaPartners: buildMediaPartners(),
    profileBlocks: buildProfileBlocks(),
    staticPages: buildStaticPages(),
    paymentPage: buildPaymentPage(),
    homeSections: buildHomeSections(),
    settings: buildSettings(),
  };
}
