"use client";

import { useFormStatus } from "react-dom";
import { setFeature } from "../actions";

function Knob({ on, label }: { on: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit" role="switch" aria-checked={on} aria-label={label} disabled={pending} title={on ? "Switch off" : "Switch on"}
      className={`relative inline-flex h-7 w-12 flex-none items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-60 ${on ? "bg-ok" : "bg-[#D9CCBF]"}`}
    >
      <span aria-hidden className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

/** The switch for one feature. Switching on a feature that messages real phones asks first. */
export function FeatureSwitch({ feature, title, on, back, ask }: { feature: string; title: string; on: boolean; back: string; /** Asked before switching on. Empty for a feature that needs no question. */ ask: string }) {
  return (
    <form action={setFeature} onSubmit={(e) => { if (!on && ask && !window.confirm(ask)) e.preventDefault(); }} className="flex items-center gap-2.5">
      <input type="hidden" name="key" value={feature} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="on" value={on ? "0" : "1"} />
      <input type="hidden" name="back" value={back} />
      <span className="text-[12.5px] font-semibold text-muted">{on ? "On" : "Off"}</span>
      <Knob on={on} label={title} />
    </form>
  );
}
