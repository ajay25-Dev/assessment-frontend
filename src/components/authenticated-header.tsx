"use client";

import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

type AuthenticatedHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  email?: string | null;
  children?: ReactNode;
  logoutLabel?: string;
};

export function AuthenticatedHeader({
  eyebrow,
  title,
  subtitle,
  email,
  children,
  logoutLabel = "Logout",
}: AuthenticatedHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            {eyebrow}
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold text-slate-950">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {subtitle}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {children}
          {email ? (
            <span className="max-w-full truncate rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-3 py-1.5 text-xs text-slate-600 sm:max-w-[260px]">
              {email}
            </span>
          ) : null}
          <form action="/api/auth/signout" method="post">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
              type="submit"
            >
              <LogOut size={16} />
              {logoutLabel}
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
