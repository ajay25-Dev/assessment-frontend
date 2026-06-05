import { Building2, ClipboardList, Layers3, LibraryBig, UsersRound } from "lucide-react";
import { requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

async function countRows(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], table: string, filter?: { column: string; value: string }) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count } = await query;
  return count || 0;
}

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();

  const [students, colleges, batches, subjects, assessments] = await Promise.all([
    countRows(supabase, "profiles", { column: "role", value: "student" }),
    countRows(supabase, "colleges"),
    countRows(supabase, "batches"),
    countRows(supabase, "subjects"),
    countRows(supabase, "assessments"),
  ]);

  const cards = [
    { label: "Registered Students", value: students, icon: UsersRound },
    { label: "Colleges", value: colleges, icon: Building2 },
    { label: "Batches", value: batches, icon: Layers3 },
    { label: "Subjects", value: subjects, icon: LibraryBig },
    { label: "Assessments", value: assessments, icon: ClipboardList },
  ];

  return (
    <div>
      <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
          Overview
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">Admin workspace</h2>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
          Manage students, colleges, batches, assessments, and question setup from one panel.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{card.value}</p>
                </div>
                <span className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
                  <Icon size={18} />
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
