import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1180px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}

export function Rule({ className = "" }: { className?: string }) {
  return <div className={`rule ${className}`} />;
}

type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
} & ComponentProps<typeof Link>;

const buttonBase =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

const buttonVariants = {
  primary: "bg-ink text-ground hover:bg-[#26231f]",
  secondary: "border border-line bg-card text-ink hover:border-gold",
  ghost: "text-ink hover:text-gold",
} as const;

const buttonSizes = { md: "h-10 px-5 text-sm", lg: "h-12 px-7 text-[15px]" } as const;

export function ButtonLink({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return (
    <Link
      {...props}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
    />
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: { variant?: keyof typeof buttonVariants; size?: keyof typeof buttonSizes } & ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
    />
  );
}

export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={`border border-line bg-card ${interactive ? "lift" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * The state pill. Wording here is load-bearing: only PAIR_AVAILABLE is allowed
 * to imply a launch is possible.
 */
export function StatePill({ state }: { state: "PAIR_AVAILABLE" | "DISCOVERY_ONLY" | "THEME_ONLY" }) {
  const map = {
    PAIR_AVAILABLE: { label: "Pair available", className: "border-gold/60 text-[#7a6534] bg-[#b99a62]/10" },
    DISCOVERY_ONLY: { label: "Discovery only", className: "border-line text-muted bg-transparent" },
    THEME_ONLY: { label: "Theme", className: "border-line text-muted bg-transparent" },
  } as const;
  const s = map[state];
  return (
    <span
      className={`inline-flex h-[22px] items-center border px-2 text-[10px] font-medium uppercase tracking-[0.12em] ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="space-y-1.5">
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "Graduation progress"}
      >
        <div className="progress-fill" style={{ width: `${pct * 100}%` }} />
      </div>
      {label ? <p className="text-[11px] text-muted tabular">{label}</p> : null}
    </div>
  );
}

/** Explicit unavailability. We never render a fabricated number in its place. */
export function Unavailable({ hint }: { hint?: string }) {
  return (
    <span className="text-muted" title={hint}>
      Unavailable
    </span>
  );
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="eyebrow">{label}</p>
      <p className="tabular text-[15px]">{children}</p>
    </div>
  );
}
