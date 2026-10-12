import type { Metadata } from "next";
import { HomeBuilder } from "./home-builder";

export const metadata: Metadata = { title: "Beranda" };

export default function HomeBuilderPage() {
  return <HomeBuilder />;
}
