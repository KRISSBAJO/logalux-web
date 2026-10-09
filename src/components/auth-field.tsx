import type { InputHTMLAttributes } from "react";

export function AuthField({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{label}</span>
      <input {...props} />
    </label>
  );
}

