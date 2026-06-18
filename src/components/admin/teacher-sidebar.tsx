"use client";

import { FileQuestion, FileText, LogOut, Pin, PinOff, Settings2, UsersRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { adminUi } from "@/lib/admin/ui";

type TeacherSidebarProps = {
  email?: string | null;
};

const STORAGE_KEY = "teacher-sidebar:pinned";
const PINNED_WIDTH = "250px";
const UNPINNED_WIDTH = "112px";

const items = [
  { href: "/admin/students", label: "Students", icon: UsersRound },
  { href: "/admin/reports", label: "Report", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
  { href: "/admin/question-bank", label: "Question Bank", icon: FileQuestion },
];

function AppLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={[
        "inline-flex items-center justify-center rounded-[16px] border border-emerald-200 bg-[linear-gradient(135deg,#0f3d2e_0%,#126149_100%)] text-white shadow-sm",
        compact ? "h-11 w-11" : "h-12 w-12",
      ].join(" ")}
      aria-hidden="true"
    >
      <span className="text-[14px] font-black tracking-[-0.08em]">JA</span>
    </div>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function setSidebarWidth(width: string) {
  document.documentElement.style.setProperty("--teacher-sidebar-width", width);
}

export function TeacherSidebar({ email }: TeacherSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [pinned, setPinned] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const expanded = pinned || hovered;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const next = stored === "0" ? false : stored === "1" ? true : true;
      queueMicrotask(() => setPinned(next));
    } catch {
      queueMicrotask(() => setPinned(true));
    }
  }, []);

  useEffect(() => {
    setSidebarWidth(expanded ? PINNED_WIDTH : UNPINNED_WIDTH);
  }, [expanded]);

  const activeItem = useMemo(
    () => items.find((item) => isActivePath(pathname, item.href)) || items[0],
    [pathname],
  );

  function togglePinned() {
      setPinned((current) => {
        const next = !current;
        try {
          window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        } catch {
          // Ignore storage failures.
        }
        return next;
      });
    }

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "same-origin",
      });
      router.replace("/login");
      router.refresh();
    } catch {
      window.location.assign("/login");
    }
  }

  return (
    <aside
      onMouseEnter={() => {
        if (!pinned) setHovered(true);
      }}
      onMouseLeave={() => {
        if (!pinned) setHovered(false);
      }}
      className={[
        "relative w-full overflow-hidden transition-all duration-200 lg:sticky lg:top-4 lg:h-fit lg:self-start lg:justify-self-start",
        adminUi.sectionCard,
        expanded ? "lg:max-w-[250px]" : "lg:max-w-[112px]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={togglePinned}
        className="absolute right-3 top-3 z-20 inline-flex items-center justify-center rounded-[12px] border border-[var(--color-border-subtle)] bg-white p-2.5 text-slate-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-800"
        aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
        title={pinned ? "Unpin sidebar" : "Pin sidebar"}
      >
        {pinned ? <PinOff size={16} /> : <Pin size={16} />}
      </button>

      <div className="border-b border-[var(--color-border-subtle)] p-4 pr-14">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="group relative inline-flex">
              <AppLogo compact={!expanded} />
              <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                Jora Assessment
              </span>
            </div>
            {/* {expanded ? (
              <p className="mt-3 truncate text-sm font-semibold text-slate-950">Students and reports</p>
            ) : null}
            {expanded ? (
              <p className="mt-2 inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Pinned
              </p>
            ) : (
              <p className="mt-2 inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                Unpinned
              </p>
            )} */}
          </div>
        </div>
      </div>

      <nav className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <div key={item.href} className="group relative">
              <Link
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={[
                  "flex items-center gap-3 rounded-[14px] border px-3 py-3 text-sm font-semibold transition-colors",
                  active
                    ? "border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] text-[var(--status-ready-text)]"
                    : "border-transparent text-slate-700 hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-bg-muted)] hover:text-slate-950",
                  expanded ? "justify-start" : "justify-center",
                ].join(" ")}
              >
                <Icon size={18} className={active ? "text-emerald-700" : "text-slate-500"} />
                {expanded ? <span className="truncate">{item.label}</span> : null}
              </Link>
              {!expanded ? (
                <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                  {item.label}
                </span>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-border-subtle)] p-4">
        {expanded && email ? (
          <div className="mb-3 text-xs text-slate-500">
            <p className="truncate">{email}</p>
            <p className="mt-1 font-medium text-slate-600">Active tab: {activeItem.label}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          aria-label="Logout"
          title="Logout"
          className={[
            "group inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-70",
            expanded ? "" : "relative",
          ].join(" ")}
        >
          <LogOut size={16} />
          {signingOut ? "Signing out..." : expanded ? "Logout" : ""}
          {!expanded ? (
            <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
              Logout
            </span>
          ) : null}
        </button>
      </div>
    </aside>
  );
}
