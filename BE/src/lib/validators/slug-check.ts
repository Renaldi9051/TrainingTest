import { z } from "zod";

export const slugCheckQuerySchema = z.object({
  entity: z.enum(["category", "training", "service", "page"], { error: "Entitas tidak dikenal." }),
  slug: z.string().trim().max(200),
  excludeId: z.uuid().optional(),
});
export type SlugCheckQuery = z.infer<typeof slugCheckQuerySchema>;
