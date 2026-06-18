import { CheckCircle2, ListChecks, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { AuthenticatedHeader } from "@/components/authenticated-header";
import { sectionOrder } from "@/data/assessment-bank";
import { fetchAssessmentBank } from "@/lib/assessment-bank-api";
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
  question_id?: string | null;
  section: string | null;
  status: string | null;
  answer_text?: string | null;
  selected_language?: string | null;
  selected_options?: string[] | null;
  marked_for_review?: boolean | null;
  run_count?: number | null;
  submit_count: number | null;
};

type JsonRecord = Record<string, unknown>;

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

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Not available";
  }
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
  const showDebugCalculations = process.env.NODE_ENV !== "production";
  const reportHeader = (
    <AuthenticatedHeader
      eyebrow="Jora Assessment"
      title="Assessment Report"
      subtitle="Review the submitted attempt, section counts, and scoring breakdown."
      email={user.email}
    />
  );
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
  if (!report) {
    const { data: attemptRows, error: attemptError } = attemptId
      ? await serviceSupabase
          .from("student_assessment_attempts")
          .select("id,status,submitted_at,client_metadata")
          .eq("id", attemptId)
          .eq("student_id", user.id)
          .limit(1)
      : await serviceSupabase
          .from("student_assessment_attempts")
          .select("id,status,submitted_at,client_metadata")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

    if (attemptError) {
      throw new Error(`Could not load assessment attempt details: ${attemptError.message}`);
    }

    const attempt = (((attemptRows || [])[0] || null) as {
      id: string;
      status: string | null;
      submitted_at: string | null;
      client_metadata: {
        source_assessment_id?: string;
        integrity_status?: string;
        integrity_source?: "tab_switch" | "camera" | "copy_paste" | "inspect_mode" | "logout" | "browser_back" | null;
        integrity_message?: string;
        integrity_event_count?: number | null;
      } | null;
    } | null);

    if (!attempt) redirect("/dashboard");

    const { data: questionRows, error: questionError } = await serviceSupabase
      .from("student_question_attempts")
      .select("question_id,section,status,answer_text,selected_language,selected_options,marked_for_review,run_count,submit_count")
      .eq("attempt_id", attempt.id);

    if (questionError) {
      throw new Error(`Could not load submitted question details: ${questionError.message}`);
    }

    const bank = await fetchAssessmentBank().catch(() => null);
    const questions = bank?.questions || [];
    const counts = sectionOrder.map((section) => {
      const total = questions.filter((question) => question.section === section).length;
      const rows = ((questionRows || []) as QuestionAttemptRow[]).filter((row) => row.section === section);
      const submitted = rows.filter((row) => row.status === "submitted" || Number(row.submit_count || 0) > 0).length;
      return {
        section,
        submitted,
        total,
      };
    });

    const { data: evaluationRows, error: evaluationError } = await serviceSupabase
      .from("student_question_evaluations")
      .select("section,question_id,deterministic_score,final_score,ai_evaluation")
      .eq("attempt_id", attempt.id)
      .order("created_at", { ascending: true });

    if (evaluationError) {
      throw new Error(`Could not load question evaluations: ${evaluationError.message}`);
    }

    const isDisqualified =
      attempt.status === "disqualified" ||
      attempt.client_metadata?.integrity_status === "disqualified";

    return (
      <>
        {reportHeader}
        <main className="grid min-h-dvh place-items-center bg-[#f6f8f4] px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
          <section className="w-full max-w-5xl overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[linear-gradient(135deg,#0f3d2e_0%,#126149_58%,#e2c45b_180%)] px-5 py-6 text-white sm:px-8">
            <p className="inline-flex items-center gap-2 rounded-[8px] bg-white/12 px-3 py-1 text-sm font-semibold text-emerald-50">
              {isDisqualified ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
              {isDisqualified ? "Assessment disqualified" : "Assessment submitted"}
            </p>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              {isDisqualified
                ? "The assessment ended because an integrity violation was detected."
                : "Thank you your assessment is submitted here is the details"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-emerald-50">
              {bank?.assessment?.title || "Assessment"} was submitted on {formatDate(attempt.submitted_at)}.
            </p>
            {isDisqualified ? (
              <p className="mt-3 max-w-3xl rounded-[10px] border border-white/15 bg-white/10 px-4 py-3 text-sm leading-6 text-emerald-50">
                {attempt.client_metadata?.integrity_message || "Cheating signals from tab or camera activity stopped the assessment and marked the attempt as disqualified."}
              </p>
            ) : null}
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

            {showDebugCalculations ? (
              <section className="mt-6 rounded-[16px] border border-dashed border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={18} className="text-emerald-700" />
                  <h3 className="text-base font-semibold text-slate-950">Development calculation breakdown</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This block is shown only in development so you can verify the persisted per-question output after submit.
                </p>

                <div className="mt-4 grid gap-4">
                  <div className="rounded-[14px] border border-emerald-200 bg-white p-4">
                    <h4 className="text-sm font-semibold text-slate-950">Question evaluations</h4>
                    <div className="mt-3 grid gap-3">
                      {Object.entries(
                        (evaluationRows || []).reduce<Record<string, unknown[]>>((map, row) => {
                          const section = String((row as { section?: string }).section || "Unknown");
                          const current = map[section] || [];
                          current.push(row);
                          map[section] = current;
                          return map;
                        }, {}),
                      ).length ? (
                        Object.entries(
                          (evaluationRows || []).reduce<Record<string, unknown[]>>((map, row) => {
                            const section = String((row as { section?: string }).section || "Unknown");
                            const current = map[section] || [];
                            current.push(row);
                            map[section] = current;
                            return map;
                          }, {}),
                        ).map(([section, evaluations]) => (
                          <details key={section} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                              {section}
                            </summary>
                            <pre className="mt-3 max-h-80 overflow-auto rounded-[10px] bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                              {prettyJson(evaluations)}
                            </pre>
                          </details>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">No question calculations available.</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
          </section>
        </main>
      </>
    );
  }
  const reportJson = (report.report_json || {}) as IntegrityReport & JsonRecord;
  const integrity = reportJson.integrity;
  const isDisqualified = integrity?.status === "disqualified";
  const dashboardEvaluation = asRecord(reportJson.dashboard_evaluation);
  const dashboardInput = asRecord(reportJson.dashboard_input);
  const deterministicReadiness = asRecord(reportJson.deterministic_readiness);
  const sectionEvaluations = asRecord(reportJson.section_evaluations);

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
    <>
      {reportHeader}
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
            </div>
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

          {showDebugCalculations ? (
            <section className="mt-6 rounded-[16px] border border-dashed border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-emerald-700" />
                <h3 className="text-base font-semibold text-slate-950">Development calculation breakdown</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This block is shown only in development so you can verify the full scoring payload after submit.
              </p>

              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-[14px] border border-emerald-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-950">Dashboard evaluation output</h4>
                  <pre className="mt-3 max-h-96 overflow-auto rounded-[12px] bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                    {prettyJson(dashboardEvaluation.output || dashboardEvaluation)}
                  </pre>
                </div>

                <div className="rounded-[14px] border border-emerald-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-950">Deterministic readiness payload</h4>
                  <pre className="mt-3 max-h-96 overflow-auto rounded-[12px] bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                    {prettyJson(deterministicReadiness)}
                  </pre>
                </div>
              </div>

              <div className="mt-4 grid gap-4">
                <div className="rounded-[14px] border border-emerald-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-950">Dashboard input</h4>
                  <pre className="mt-3 max-h-72 overflow-auto rounded-[12px] bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                    {prettyJson(dashboardInput)}
                  </pre>
                </div>

                <div className="rounded-[14px] border border-emerald-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-950">Section calculations</h4>
                  <div className="mt-3 grid gap-3">
                    {Object.entries(sectionEvaluations).length ? (
                      Object.entries(sectionEvaluations).map(([section, evaluations]) => (
                        <details key={section} className="rounded-[12px] border border-slate-200 bg-slate-50 p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                            {section}
                          </summary>
                          <pre className="mt-3 max-h-80 overflow-auto rounded-[10px] bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                            {prettyJson(evaluations)}
                          </pre>
                        </details>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">No section calculations available.</p>
                    )}
                  </div>
                </div>
              </div>

              <details className="mt-4 rounded-[14px] border border-emerald-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">Raw report JSON</summary>
                <pre className="mt-3 max-h-[32rem] overflow-auto rounded-[12px] bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-100">
                  {prettyJson(reportJson)}
                </pre>
              </details>
            </section>
          ) : null}

        </div>
      </section>
    </main>
    </>
  );
}
