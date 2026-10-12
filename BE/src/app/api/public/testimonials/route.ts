import { ok, route } from "@/lib/http";
import { listPublicTestimonials } from "@/services/testimonial";

export const dynamic = "force-dynamic";

export const GET = route(async () => ok(await listPublicTestimonials()));
