import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ArticleForm } from "../article-form";

export const metadata: Metadata = { title: "Tulis artikel" };

export default function NewArticlePage() {
  return (
    <>
      <PageHeader title="Tulis artikel" />
      <ArticleForm article={null} />
    </>
  );
}
