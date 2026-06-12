import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin/supabase-admin";
import { TeacherSidebar } from "@/components/admin/teacher-sidebar";
import { AuthenticatedHeader } from "@/components/authenticated-header";
import { adminUi } from "@/lib/admin/ui";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireAdmin();

  return (
    <main className={adminUi.appShell}>
      <AuthenticatedHeader
        eyebrow="Teacher workspace"
        title="Student creation and report review"
        subtitle="Manage assessments, batches, question banks, and student reports."
        email={profile?.email || null}
      />
      <div className={adminUi.appFrame}>
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
