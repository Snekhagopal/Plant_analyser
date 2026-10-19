import type { Metadata } from "next";
import PlantGuideView from "@/components/pages/PlantGuideView";

export const metadata: Metadata = { title: "Plant Guide" };

export default async function PlantGuidePage({ searchParams }: PageProps<"/plant-guide">) {
  const { name } = await searchParams;
  return <PlantGuideView initialName={typeof name === "string" ? name : null} />;
}
