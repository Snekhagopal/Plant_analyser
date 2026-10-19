import type { Metadata } from "next";
import DiseaseLibraryView from "@/components/pages/DiseaseLibraryView";

export const metadata: Metadata = { title: "Plant Diseases" };

export default function DiseaseLibraryPage() {
  return <DiseaseLibraryView />;
}
