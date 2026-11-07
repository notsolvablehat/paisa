import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";
import { RemindersPage } from "@/components/reminders/reminders-page";
import { getSessionUser } from "@/server/session";

export const metadata: Metadata = { title: "Reminders", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Authed />
    </Suspense>
  );
}

async function Authed() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return <RemindersPage user={{ name: user.name, email: user.email }} />;
}
