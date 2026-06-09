import { CheckCircle2, Home, ListChecks, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FinalizeStageRunner } from "@/components/assessment/finalize-stage-runner";
import { sectionOrder } from "@/data/assessment-bank";
import { supabaseService } from "@/lib/supabase-service";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ attemptId?: string; mode?: string }> | { attemptId?: string; mode?: string };
};

type ReportRow = {
  id: string;
  attempt_id: string | null;
  student_id: string;
  assessment_title: string | null;
  marks_score: number | null;
  capability_score: number | null;
  readiness_label: string | null;
  faculty_insight: string | null;
  company_recommendation: string | null;
  created_at: string | null;
  report_json: unknown;
};

type IntegrityReport = {
  integrity?: {
    status?: string;
    source?: string;
    message?: string;
    event_count?: number;
  };
};

type QuestionAttemptRow = {
  section: string | null;
  status: string | null;
  submit_count: number | null;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AssessmentReportPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const attemptId = resolvedSearchParams.attemptId;
  const isAutoSubmitted = resolvedSearchParams.mode === "auto";

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = attemptId ? `/assessment/report?attemptId=${encodeURIComponent(attemptId)}` : "/assessment/report";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const serviceSupabase = supabaseService();
  let reportQuery = serviceSupabase
    .from("student_assessment_reports")
    .select(
      [
        "id",
        "attempt_id",
        "student_id",
        "assessment_title",
        "marks_score",
        "capability_score",
        "readiness_label",
        "faculty_insight",
        "company_recommendation",
        "created_at",
        "report_json",
      ].join(","),
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (attemptId) {
    reportQuery = reportQuery.eq("attempt_id", attemptId);
  }

  const { data: reportRows, error: reportError } = await reportQuery;
  if (reportError) {
    throw new Error(`Could not load assessment report: ${reportError.message}`);
  }

  const report = (((reportRows || [])[0] || null) as unknown) as ReportRow | null;
  if (!report) redirect("/dashboard");
  const reportJson = (report.report_json || {}) as IntegrityReport;
  const integrity = reportJson.integrity;
  const isDisqualified = integrity?.status === "disqualified";

  const { data: questionRows, error: questionError } = report.attempt_id
    ? await serviceSupabase
        .from("student_question_attempts")
        .select("section,status,submit_count")
        .eq("attempt_id", report.attempt_id)
    : { data: [], error: null };

  if (questionError) {
    throw new Error(`Could not load submitted question details: ${questionError.message}`);
  }

  const counts = sectionOrder.map((section) => {
    const rows = ((questionRows || []) as QuestionAttemptRow[]).filter((row) => row.section === section);
    const submitted = rows.filter((row) => row.status === "submitted" || Number(row.submit_count || 0) > 0).length;
    return {
      section,
      submitted,
      total: rows.length,
    };
  });

  return (
    <main className="grid min-h-dvh place-items-center bg-[#f6f8f4] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <section className="w-full max-w-5xl overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#0f3d2e_0%,#126149_58%,#e2c45b_180%)] px-5 py-6 text-white sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-[8px] bg-white/12 px-3 py-1 text-sm font-semibold text-emerald-50">
                {isDisqualified ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
                {isDisqualified ? "Assessment disqualified" : isAutoSubmitted ? "Auto submitted after time over" : "Assessment submitted"}
              </p>
              <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                {isDisqualified ? "The assessment ended because an integrity violation was detected." : "Thank you your assessment is submitted here is the details"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-emerald-50">
                {report.assessment_title || "Assessment"} was submitted on {formatDate(report.created_at)}.
              </p>
              {isDisqualified ? (
                <p className="mt-3 max-w-3xl rounded-[10px] border border-white/15 bg-white/10 px-4 py-3 text-sm leading-6 text-emerald-50">
                  {integrity?.message || "Cheating signals from tab or camera activity stopped the assessment and marked the attempt as disqualified."}
                </p>
              ) : null}
              {report.attempt_id ? <FinalizeStageRunner attemptId={report.attempt_id} /> : null}
            </div>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white hover:bg-white/15"
            >
              <Home size={16} />
              Dashboard
            </Link>
          </div>
        </div>

        <div className="p-5 sm:p-8">
          <div className="flex items-center gap-2">
            <ListChecks size={18} className="text-emerald-700" />
            <h2 className="text-lg font-semibold text-slate-950">Submitted Questions By Subject</h2>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {counts.map((item) => (
              <div key={item.section} className="rounded-[8px] border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-600">{item.section}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {item.submitted}
                  <span className="text-base font-medium text-slate-500"> / {item.total}</span>
                </p>
                <p className="mt-2 text-xs text-slate-500">submitted questions</p>
              </div>
            ))}
          </div>

        </div>
      </section>
    </main>
  );
}
