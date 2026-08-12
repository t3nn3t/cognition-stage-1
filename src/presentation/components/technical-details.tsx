import type { ReactNode } from "react";
import { CopyButton } from "./copy-button";

export function TechnicalDetails({
  entries,
  children,
}: {
  entries: readonly { label: string; value: string }[];
  children?: ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-zinc-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-zinc-600 select-none hover:text-zinc-900">
        Technical details
      </summary>
      <dl className="space-y-2 border-t border-zinc-100 px-4 py-3">
        {entries.map((entry) => (
          <div
            key={entry.label}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <dt className="text-xs font-medium text-zinc-500">{entry.label}</dt>
            <dd className="flex items-center gap-1 font-mono text-xs text-zinc-700">
              <span className="max-w-64 truncate">{entry.value}</span>
              <CopyButton value={entry.value} />
            </dd>
          </div>
        ))}
        {children}
      </dl>
    </details>
  );
}
