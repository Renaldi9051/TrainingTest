import type { Metadata } from "next";
import { TestimonialsManager } from "./testimonials-manager";

export const metadata: Metadata = { title: "Testimoni" };

export default function TestimonialsPage() {
  return <TestimonialsManager />;
}
