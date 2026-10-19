import type { Metadata } from "next";
import HistoryView from "@/components/pages/HistoryView";

export const metadata: Metadata = { title: "Past Checks" };

export default function HistoryPage() {
  return <HistoryView />;
}
