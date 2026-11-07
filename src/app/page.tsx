import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/dashboard";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";
import { getSessionUser } from "@/server/session";

export default function Page() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthedDashboard />
    </Suspense>
  );
}

async function AuthedDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return <Dashboard user={{ name: user.name, email: user.email }} />;
}
