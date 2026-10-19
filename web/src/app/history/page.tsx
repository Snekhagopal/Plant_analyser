import type { Metadata } from "next";
import HistoryView from "@/components/pages/HistoryView";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return <HistoryView />;
}
