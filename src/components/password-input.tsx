"use client";
import { useId, useState, type InputHTMLAttributes } from "react";
export function PasswordInput({ className = "", id, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
 const [visible, setVisible] = useState(false);
 const generated = useId();
 const inputId = id || generated;
 return <span className="relative block w-full"><input {...props} id={inputId} type={visible ? "text" : "password"} className={`${className} w-full !pr-20`} /><button type="button" aria-controls={inputId} aria-pressed={visible} aria-label={`${visible ? "Hide" : "Show"} password`} onClick={() => setVisible(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] font-semibold text-wine hover:bg-cream-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">{visible ? "Hide" : "Show"}</button></span>;
}
