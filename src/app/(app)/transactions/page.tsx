import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/dashboard/primitives";
import { TransactionsPage } from "@/components/transactions/transactions-page";

export const metadata: Metadata = {
  title: "Transactions",
  robots: { index: false, follow: false },
};

export default function Page() {
  // The date range lives in the URL (useSearchParams), which needs its own boundary.
  return (
    <Suspense
      fallback={
        <div className="grid place-items-center py-32">
          <Spinner />
        </div>
      }
    >
      <TransactionsPage />
    </Suspense>
  );
}
