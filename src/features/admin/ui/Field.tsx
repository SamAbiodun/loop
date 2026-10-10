"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

// Paper-register text fields: hairline border, ink on focus, no ring, no hue.
const FIELD =
  "w-full rounded-lg border border-line-strong bg-raised px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink disabled:cursor-not-allowed disabled:opacity-50";

export function Input({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD} ${className}`} {...rest} />;
}

export function Textarea({
  className = "",
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD} resize-none ${className}`} {...rest} />;
}
