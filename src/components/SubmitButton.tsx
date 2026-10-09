"use client";

import { useFormStatus } from "react-dom";

/** Knop die direct laat zien dat er iets gebeurt na een tik. */
export function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending || disabled} aria-busy={pending} className={`${className ?? ""} disabled:opacity-70`}>
      {pending ? (pendingText ?? "Even geduld…") : children}
    </button>
  );
}
