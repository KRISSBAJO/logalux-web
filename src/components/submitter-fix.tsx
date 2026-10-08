"use client";
import { useEffect } from "react";

/**
 * Makes the pressed button's own name and value reach the server action.
 * React adds them through a temporary input tied to `form.id`, and a hidden field named "id"
 * (which most of our forms have) shadows that property, so the value was silently dropped.
 * Before each submit this puts the pressed button's value in a real hidden field instead.
 */
export function SubmitterFix() {
  useEffect(() => {
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.tagName !== "FORM") return;
      form.querySelectorAll("input[data-pressed]").forEach((x) => x.remove());
      const b = e.submitter as HTMLButtonElement | HTMLInputElement | null;
      if (!b || !b.name || typeof form.id === "string") return;
      const keep = document.createElement("input");
      keep.type = "hidden";
      keep.name = b.name;
      keep.value = b.value;
      keep.setAttribute("data-pressed", "");
      form.appendChild(keep);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);
  return null;
}
