"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

const field =
  "border-or-400/20 bg-noir-900/60 text-ivoire placeholder:text-ivoire-faint focus:border-or-400/60 focus:ring-or-400/20 w-full rounded-lg border px-4 py-2.5 font-sans outline-none transition focus:ring-2";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(field, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select className={cn(field, className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      className={cn("text-ivoire-muted font-sans text-xs tracking-wider uppercase", className)}
      {...props}
    />
  );
}

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 w-full rounded-lg bg-gradient-to-b px-4 py-2.5 font-sans text-sm font-semibold shadow-lg transition disabled:opacity-60",
        className,
      )}
    >
      {pending ? "…" : children}
    </button>
  );
}
