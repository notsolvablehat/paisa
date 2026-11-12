import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <Dashboard />;
}
