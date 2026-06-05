import {
  BarChart3,
  Building2,
  ClipboardList,
  FileJson,
  GraduationCap,
  Layers3,
  LibraryBig,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/supabase-admin";

const navItems = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/students", label: "Students", icon: UsersRound },
  { href: "/admin/colleges", label: "Colleges", icon: Building2 },
  { href: "/admin/batches", label: "Batches", icon: Layers3 },
  { href: "/admin/subjects", label: "Subjects", icon: LibraryBig },
  { href: "/admin/assessments", label: "Assessments", icon: ClipboardList },
  { href: "/admin/question-bank", label: "Question Bank", icon: FileJson },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <main className="min-h-dvh bg-[#f6f8f4]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Jora Admin
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Control Panel</h1>
          </div>
          <div className="hidden items-center gap-2 text-sm text-slate-600 sm:flex">
            <GraduationCap size={17} />
            {profile?.email}
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="rounded-[8px] border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <nav className="grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-[8px] px-3 py-2 text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section>{children}</section>
      </div>
    </main>
  );
}
