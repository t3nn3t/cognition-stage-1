"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`block rounded-md px-3 py-1.5 text-sm font-medium ${
        active
          ? "bg-indigo-50 text-indigo-700"
          : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
      }`}
    >
      {children}
    </Link>
  );
}
