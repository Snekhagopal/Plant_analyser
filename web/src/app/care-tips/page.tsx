import type { Metadata } from "next";
import CareTipsView from "@/components/pages/CareTipsView";

export const metadata: Metadata = { title: "Care Tips" };

export default function CareTipsPage() {
  return <CareTipsView />;
}
