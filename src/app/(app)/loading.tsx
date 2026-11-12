import { Spinner } from "@/components/dashboard/primitives";

/** While a page's code loads, the header stays and only the content area shows a spinner. */
export default function Loading() {
  return (
    <div className="grid place-items-center py-32">
      <Spinner label="Loading page" />
    </div>
  );
}
