import Link from "next/link";
import { EmptyState } from "@/presentation/components/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-16">
      <EmptyState
        title="Page not found"
        description="The record you are looking for does not exist."
      />
      <p className="mt-4 text-center text-sm">
        <Link
          href="/"
          className="font-medium text-indigo-600 hover:text-indigo-700"
        >
          Back to Overview
        </Link>
      </p>
    </div>
  );
}
