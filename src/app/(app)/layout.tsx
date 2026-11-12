import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppFrame } from "@/components/dashboard/app-shell";
import { Spinner } from "@/components/dashboard/primitives";
import { getSessionUser } from "@/server/session";

/**
 * Shared by every signed-in page. The frame (header, dialogs, dashboard data) mounts once here,
 * so moving between pages only swaps the content under the header; there's no whole-page loader.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<FirstLoad />}>
      <Authed>{children}</Authed>
    </Suspense>
  );
}

async function Authed({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");
  return (
    <AppFrame user={{ name: user.name, email: user.email }}>
      {children}
    </AppFrame>
  );
}

/** Only on a full page load, while the session is checked: an empty header bar and a spinner. */
function FirstLoad() {
  return (
    <div className="min-h-dvh bg-(--p-bg)" aria-busy="true">
      <div className="h-[68px] border-b border-(--p-line) max-md:h-[105px]" />
      <div className="grid place-items-center pt-32">
        <Spinner label="Loading paisa" />
      </div>
    </div>
  );
}
