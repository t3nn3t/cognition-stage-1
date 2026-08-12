import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-zinc-700"
      >
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export const inputClassName =
  "block w-full rounded-md border-0 bg-white px-3 py-1.5 text-sm text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600";
