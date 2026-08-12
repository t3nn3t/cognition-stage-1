"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ columns }: { columns: readonly string[] }) {
  return (
    <thead>
      <tr className="border-b border-zinc-200 text-left">
        {columns.map((column) => (
          <th
            key={column}
            scope="col"
            className="px-4 py-2.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase"
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TableRow({
  children,
  href,
}: {
  children: ReactNode;
  href?: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={href ? () => router.push(href) : undefined}
      className={`border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 ${href ? "cursor-pointer" : ""}`}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
