import type { Metadata } from "next";
import { ClientsManager } from "./clients-manager";

export const metadata: Metadata = { title: "Klien" };

export default function ClientsPage() {
  return <ClientsManager />;
}
