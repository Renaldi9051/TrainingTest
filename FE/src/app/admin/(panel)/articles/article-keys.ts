export const articleKeys = {
  all: ["admin", "articles"] as const,
  list: (params: object) => ["admin", "articles", "list", params] as const,
  calendar: (month: string) => ["admin", "articles", "calendar", month] as const,
  detail: (id: string) => ["admin", "articles", "detail", id] as const,
  categories: ["admin", "article-categories"] as const,
};

export function articlePreviewHref(id: string) {
  return `/admin/preview?type=article&id=${id}`;
}
