import { ArrowRight, FileQuestion, FileText, UsersRound } from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

async function countRows(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  table: string,
  filter?: { column: string; value: string },
) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count } = await query;
  return count || 0;
}

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();

  const [students, reports] = await Promise.all([
    countRows(supabase, "profiles", { column: "role", value: "student" }),
    countRows(supabase, "student_assessment_reports"),
  ]);

  const launchCards = [
    {
      href: "/admin/students",
      label: "Students",
      title: "Student creation",
      description: "Create and update student accounts, then assign the right batch.",
      value: students,
      icon: UsersRound,
      tone: "from-emerald-500/15 to-emerald-50",
    },
    {
      href: "/admin/reports",
      label: "Report",
      title: "Report review",
      description: "Review assessment outcomes, weak spots, and readiness signals.",
      value: reports,
      icon: FileText,
      tone: "from-slate-900/8 to-slate-100",
    },
    {
      href: "/admin/settings",
      label: "Settings",
      title: "Security controls",
      description: "Set anti-cheat toggles, camera rules, and timer restart behavior.",
      value: "Live",
      icon: FileQuestion,
      tone: "from-emerald-500/15 to-emerald-50",
    },
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">
              Overview
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              Teacher workspace
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              Use the left menu to switch between student creation and report review.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:w-[320px]">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Registered students</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{students}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Submitted reports</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{reports}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {launchCards.map((card) => {
          const Icon = card.icon;

          return (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-[75%]">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                    {card.label}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
                </div>
                <span className="rounded-[16px] border border-slate-200 bg-slate-50 p-3 text-emerald-800">
                  <Icon size={20} />
                </span>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-950">
                  {typeof card.value === "number" ? `${card.value} total` : card.value}
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  Open
                  <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
