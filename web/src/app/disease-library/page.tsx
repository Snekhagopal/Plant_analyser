import type { Metadata } from "next";
import DiseaseLibraryView from "@/components/pages/DiseaseLibraryView";

export const metadata: Metadata = { title: "Disease Library" };

export default function DiseaseLibraryPage() {
  return <DiseaseLibraryView />;
}
