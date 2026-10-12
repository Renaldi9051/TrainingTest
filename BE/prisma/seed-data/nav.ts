// Membuat menu header & footer contoh (dengan sub-menu). Dipakai seed.ts dan sync-content-dev.ts.
import type { NavLocation, Prisma } from "../../src/generated/prisma/client";
import { footerNav, headerNav, type SeedNavItem } from "./content";

type NavClient = Pick<Prisma.TransactionClient, "navItem">;

async function createLocation(db: NavClient, location: NavLocation, items: SeedNavItem[]): Promise<number> {
  let created = 0;
  for (const [order, item] of items.entries()) {
    const parent = await db.navItem.create({ data: { location, label: item.label, href: item.href, order } });
    created += 1;
    for (const [childOrder, child] of (item.children ?? []).entries()) {
      await db.navItem.create({
        data: { location, label: child.label, href: child.href, order: childOrder, parentId: parent.id },
      });
      created += 1;
    }
  }
  return created;
}

// Jumlah baris NavItem yang dibuat.
export async function createSeedNav(db: NavClient): Promise<number> {
  return (await createLocation(db, "HEADER", headerNav)) + (await createLocation(db, "FOOTER", footerNav));
}
