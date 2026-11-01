"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/admin/ui/tabs";
import { ArticlesCalendar } from "./articles-calendar";
import { ArticlesList } from "./articles-list";

const VIEWS = ["daftar", "kalender"] as const;
type View = (typeof VIEWS)[number];

// Tab Daftar / Kalender; tab aktif disimpan di ?tab= supaya bisa dibagikan dan bertahan saat kembali.
export function ArticlesWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("tab");
  const view: View = (VIEWS as readonly string[]).includes(value ?? "") ? (value as View) : "daftar";

  return (
    <Tabs
      value={view}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams);
        if (next === "daftar") params.delete("tab");
        else params.set("tab", next);
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
    >
      <TabsList aria-label="Tampilan artikel">
        <TabsTrigger value="daftar">Daftar</TabsTrigger>
        <TabsTrigger value="kalender">Kalender</TabsTrigger>
      </TabsList>
      <TabsContent value="daftar" className="pt-4">
        <ArticlesList />
      </TabsContent>
      <TabsContent value="kalender" className="pt-4">
        <ArticlesCalendar />
      </TabsContent>
    </Tabs>
  );
}
