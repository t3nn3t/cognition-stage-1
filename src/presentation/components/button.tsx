import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
  secondary:
    "bg-white text-zinc-700 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 disabled:text-zinc-400",
  danger:
    "bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
