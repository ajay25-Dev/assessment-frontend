import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/supabase-admin";
import { TeacherSidebar } from "@/components/admin/teacher-sidebar";
import { adminUi } from "@/lib/admin/ui";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <main className={adminUi.appShell}>
      <div className={adminUi.appFrame}>
        <div className={`mb-4 ${adminUi.workspaceCard}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={adminUi.eyebrow}>
                Teacher workspace
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
                Student creation and report review
              </h1>
            </div>
            {profile?.email ? (
              <span className="max-w-full truncate rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-3 py-1.5 text-xs text-slate-600 sm:max-w-[260px]">
                {profile.email}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 transition-[grid-template-columns] duration-200 lg:grid-cols-[var(--teacher-sidebar-width)_minmax(0,1fr)] lg:items-start">
          <TeacherSidebar email={profile?.email || null} />
          <section className="min-w-0">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
