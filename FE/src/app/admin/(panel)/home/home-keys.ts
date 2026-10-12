export const homeKeys = {
  all: ["admin", "home-sections"] as const,
  list: ["admin", "home-sections", "list"] as const,
  detail: (id: string) => ["admin", "home-sections", "detail", id] as const,
};
