"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  // The one bright thing: the action you are one click from.
  primary:
    "bg-live text-live-fg hover:bg-g-2 disabled:hover:bg-live",
  secondary:
    "border border-line-strong text-ink hover:bg-raised",
  ghost: "text-ink-muted hover:text-ink hover:bg-raised",
  // Destructive actions keep the strongest contrast and need a second click
  // elsewhere; no hue is used for danger in this system.
  danger:
    "border border-ink text-ink hover:bg-ink hover:text-bg",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-muted/40 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
}
