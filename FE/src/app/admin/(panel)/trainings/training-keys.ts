export const trainingKeys = {
  all: ["admin", "trainings"] as const,
  list: (params: object) => ["admin", "trainings", "list", params] as const,
  detail: (id: string) => ["admin", "trainings", "detail", id] as const,
};
