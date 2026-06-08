import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Code2,
  Database,
  FileCode2,
  Gauge,
  GraduationCap,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

type Params = Promise<{ studentId: string; attemptId: string }>;

type ReportRow = {
  id: string;
  student_id: string | null;
  attempt_id: string | null;
  assessment_title: string | null;
  marks_score: number | null;
  capability_score: number | null;
  dsa_score: number | null;
  sql_score: number | null;
  oops_score: number | null;
  mcq_score: number | null;
  approach_score: number | null;
  complexity_score: number | null;
  code_quality_score: number | null;
  hidden_test_pass_rate: number | null;
  brute_force_risk: string | null;
  hardcoding_risk: string | null;
  compilation_behaviour: string | null;
  runtime_percentile: string | null;
  readiness_label: string | null;
  readiness_bucket: string | null;
  readiness_reason: unknown;
  strongest_section: string | null;
  weakest_section: string | null;
  training_priority: string | null;
  training_recommendation: string | null;
  teacher_action: string | null;
  risk_summary: unknown;
  faculty_insight: string | null;
  company_recommendation: string | null;
  student_summary: string | null;
  detailed_strengths: unknown;
  detailed_weaknesses: unknown;
  next_3_learning_actions: unknown;
  report_json: unknown;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type QuestionAttemptRow = {
  id: string;
  attempt_id: string;
  question_id: string;
  section: string;
  answer_text: string | null;
  selected_language: string | null;
  selected_options: unknown;
  marked_for_review: boolean | null;
  status: string | null;
  run_count: number | null;
  submit_count: number | null;
  last_autosaved_at: string | null;
};

type QuestionEvaluationRow = {
  question_id: string;
  section: string;
  deterministic_score: number | null;
  ai_evaluation: unknown;
  final_score: number | null;
};

type CodeRunRow = {
  question_id: string;
  language: string | null;
  run_type: string | null;
  source_code: string | null;
  status: string | null;
  open_tests_passed: number | null;
  open_tests_total: number | null;
  hidden_tests_passed: number | null;
  hidden_tests_total: number | null;
  raw_provider_response: unknown;
  created_at: string | null;
};

type SqlRunRow = {
  question_id: string;
  run_type: string | null;
  query_text: string | null;
  row_count: number | null;
  error_text: string | null;
  comparison_result: unknown;
  created_at: string | null;
};

type McqAnswerRow = {
  question_id: string;
  selected_options: unknown;
  is_correct: boolean | null;
};

type ReadinessBucket = "Ready" | "Training Needed" | "Failed";

function score(value: number | null | undefined) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeBucket(value: string | null | undefined, label: string | null | undefined): ReadinessBucket {
  const bucket = String(value || "").trim().toLowerCase();
  if (bucket === "ready") return "Ready";
  if (bucket === "training needed") return "Training Needed";
  if (bucket === "failed") return "Failed";

  const readiness = String(label || "").trim().toLowerCase();
  if (readiness === "elite 1% company ready" || readiness === "strong company ready") return "Ready";
  if (readiness === "near ready" || readiness === "trainable but not ready") return "Training Needed";
  if (readiness === "risky high scorer" || readiness === "not ready") return "Failed";
  if (readiness.includes("risk") || readiness.includes("fail")) return "Failed";
  if (readiness.includes("need") || readiness.includes("practice") || readiness.includes("train")) return "Training Needed";
  return "Ready";
}

function readinessClasses(value: ReadinessBucket) {
  if (value === "Failed") return "border-red-200 bg-red-50 text-red-800";
  if (value === "Training Needed") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function sectionIcon(section: string) {
  if (section === "DSA") return Code2;
  if (section === "SQL") return Database;
  if (section === "OOPs") return Wrench;
  return BookOpen;
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function aiOutput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!record.output || typeof record.output !== "object" || Array.isArray(record.output)) return null;
  return record.output as Record<string, unknown>;
}

function aiQuestionTitle(value: unknown, questionId: string) {
  const output = aiOutput(value);
  return String(output?.question_title || questionId);
}

function outputText(output: Record<string, unknown> | null, key: string) {
  const value = output?.[key];
  return typeof value === "string" && value.trim() ? value : "Unknown";
}

function outputScore(output: Record<string, unknown> | null, key: string) {
  return score(typeof output?.[key] === "number" ? output[key] : null);
}

export default async function AttemptReportCardPage({
  params,
}: {
  params: Params;
}) {
  const { studentId, attemptId } = await params;
  const { supabase } = await requireAdmin();

  const [
    { data: reportRow, error: reportError },
    { data: profileRow },
    { data: questionAttemptRows },
    { data: evaluationRows },
    { data: codeRunRows },
    { data: sqlRunRows },
    { data: mcqRows },
  ] = await Promise.all([
    supabase
      .from("student_assessment_reports")
      .select(
        [
          "id",
          "student_id",
          "attempt_id",
          "assessment_title",
          "marks_score",
          "capability_score",
          "dsa_score",
          "sql_score",
          "oops_score",
          "mcq_score",
          "approach_score",
          "complexity_score",
          "code_quality_score",
          "hidden_test_pass_rate",
          "brute_force_risk",
          "hardcoding_risk",
          "compilation_behaviour",
          "runtime_percentile",
          "readiness_label",
          "readiness_bucket",
          "readiness_reason",
          "strongest_section",
          "weakest_section",
          "training_priority",
          "training_recommendation",
          "teacher_action",
          "risk_summary",
          "faculty_insight",
          "company_recommendation",
          "student_summary",
          "detailed_strengths",
          "detailed_weaknesses",
          "next_3_learning_actions",
          "report_json",
          "created_at",
        ].join(","),
      )
      .eq("student_id", studentId)
      .eq("attempt_id", attemptId)
      .maybeSingle(),
    supabase.from("profiles").select("id,email,full_name").eq("id", studentId).maybeSingle(),
    supabase
      .from("student_question_attempts")
      .select("id,attempt_id,question_id,section,answer_text,selected_language,selected_options,marked_for_review,status,run_count,submit_count,last_autosaved_at")
      .eq("attempt_id", attemptId)
      .order("section")
      .order("question_id"),
    supabase
      .from("student_question_evaluations")
      .select("question_id,section,deterministic_score,ai_evaluation,final_score")
      .eq("attempt_id", attemptId)
      .order("section")
      .order("question_id"),
    supabase
      .from("student_code_runs")
      .select("question_id,language,run_type,source_code,status,open_tests_passed,open_tests_total,hidden_tests_passed,hidden_tests_total,raw_provider_response,created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_sql_runs")
      .select("question_id,run_type,query_text,row_count,error_text,comparison_result,created_at")
      .eq("attempt_id", attemptId)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_mcq_answers")
      .select("question_id,selected_options,is_correct")
      .eq("attempt_id", attemptId),
  ]);

  if (reportError) {
    throw new Error(`Could not load attempt report card: ${reportError.message}`);
  }

  const report = (reportRow || null) as ReportRow | null;
  const profile = (profileRow || null) as ProfileRow | null;
  const questionAttempts = (questionAttemptRows || []) as unknown as QuestionAttemptRow[];
  const evaluations = (evaluationRows || []) as unknown as QuestionEvaluationRow[];
  const codeRuns = (codeRunRows || []) as unknown as CodeRunRow[];
  const sqlRuns = (sqlRunRows || []) as unknown as SqlRunRow[];
  const mcqAnswers = (mcqRows || []) as unknown as McqAnswerRow[];

  if (!report) notFound();

  const readinessBucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
  const evaluationByQuestionId = new Map(evaluations.map((item) => [item.question_id, item]));
  const latestCodeRunByQuestionId = new Map<string, CodeRunRow>();
  const latestSqlRunByQuestionId = new Map<string, SqlRunRow>();
  const mcqByQuestionId = new Map(mcqAnswers.map((item) => [item.question_id, item]));

  for (const row of codeRuns) {
    if (!latestCodeRunByQuestionId.has(row.question_id)) {
      latestCodeRunByQuestionId.set(row.question_id, row);
    }
  }
  for (const row of sqlRuns) {
    if (!latestSqlRunByQuestionId.has(row.question_id)) {
      latestSqlRunByQuestionId.set(row.question_id, row);
    }
  }

  const groupedSections = ["DSA", "SQL", "OOPs", "MCQ"].map((section) => ({
    section,
    questions: questionAttempts.filter((item) => item.section === section),
  })).filter((group) => group.questions.length > 0);

  const readinessReason = stringify(report.readiness_reason);
  const riskSummary = stringify(report.risk_summary);
  const detailedStrengths = asStringArray(report.detailed_strengths);
  const detailedWeaknesses = asStringArray(report.detailed_weaknesses);
  const nextActions = asStringArray(report.next_3_learning_actions);

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Attempt Report Card
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">
              {report.assessment_title || "Untitled assessment"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {profile?.full_name || "Unnamed student"} | {profile?.email || studentId}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className={`rounded-[8px] border px-3 py-2 font-semibold ${readinessClasses(readinessBucket)}`}>
                {readinessBucket}
              </span>
              <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                {report.readiness_label || "-"}
              </span>
              <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                Strongest {report.strongest_section || "-"}
              </span>
              <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                Weakest {report.weakest_section || "-"}
              </span>
              <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                Submitted {formatDate(report.created_at)}
              </span>
            </div>
          </div>
          <Link
            href={`/admin/reports/students/${studentId}`}
            className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Profile
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Marks Score</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{score(report.marks_score)}</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Capability Score</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{score(report.capability_score)}</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Hidden Tests</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{score(report.hidden_test_pass_rate)}</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Compilation Behaviour</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{report.compilation_behaviour || "-"}</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Runtime Percentile</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{report.runtime_percentile || "Unknown"}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <BadgeCheck size={18} />
            <h3 className="font-semibold">Decision Summary</h3>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-slate-700">
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Training Priority</p>
              <p className="mt-2 leading-6">{report.training_priority || "-"}</p>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Training Recommendation</p>
              <p className="mt-2 leading-6">{report.training_recommendation || "-"}</p>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Teacher Action</p>
              <p className="mt-2 leading-6">{report.teacher_action || "-"}</p>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Faculty Insight</p>
              <p className="mt-2 leading-6">{report.faculty_insight || "-"}</p>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Company Recommendation</p>
              <p className="mt-2 leading-6">{report.company_recommendation || "-"}</p>
            </div>
          </div>
        </article>

        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <CircleAlert size={18} />
            <h3 className="font-semibold">Readiness Evidence</h3>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Readiness Reason</p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-700">{readinessReason}</pre>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Risk Summary</p>
              <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-700">{riskSummary}</pre>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Student Summary</h3>
          <p className="mt-4 leading-7 text-slate-700">{report.student_summary || "-"}</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Next Learning Actions</h3>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {(nextActions.length ? nextActions : ["-"]).map((item) => (
              <li key={item} className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Detailed Strengths</h3>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {(detailedStrengths.length ? detailedStrengths : ["-"]).map((item) => (
              <li key={item} className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">{item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Detailed Weaknesses</h3>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
            {(detailedWeaknesses.length ? detailedWeaknesses : ["-"]).map((item) => (
              <li key={item} className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <Code2 size={18} />
            <h3 className="font-semibold">DSA</h3>
          </div>
          <p className="mt-4 text-3xl font-semibold text-slate-950">{score(report.dsa_score)}</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <Database size={18} />
            <h3 className="font-semibold">SQL</h3>
          </div>
          <p className="mt-4 text-3xl font-semibold text-slate-950">{score(report.sql_score)}</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <Wrench size={18} />
            <h3 className="font-semibold">OOPs</h3>
          </div>
          <p className="mt-4 text-3xl font-semibold text-slate-950">{score(report.oops_score)}</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <BookOpen size={18} />
            <h3 className="font-semibold">MCQ</h3>
          </div>
          <p className="mt-4 text-3xl font-semibold text-slate-950">{score(report.mcq_score)}</p>
        </article>
      </section>

      {groupedSections.map((group) => {
        const Icon = sectionIcon(group.section);
        return (
          <section key={group.section} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <Icon size={18} />
              <h3 className="font-semibold">{group.section} Question Evidence</h3>
            </div>
            <div className="mt-5 grid gap-4">
              {group.questions.map((question) => {
                const evaluation = evaluationByQuestionId.get(question.question_id);
                const codeRun = latestCodeRunByQuestionId.get(question.question_id);
                const sqlRun = latestSqlRunByQuestionId.get(question.question_id);
                const mcq = mcqByQuestionId.get(question.question_id);
                const title = evaluation ? aiQuestionTitle(evaluation.ai_evaluation, question.question_id) : question.question_id;
                const evaluationOutput = aiOutput(evaluation?.ai_evaluation);
                const showDsaComplexity = group.section === "DSA";
                const mcqScoreLabel =
                  mcq?.is_correct === null || mcq?.is_correct === undefined
                    ? "Pending"
                    : mcq.is_correct
                      ? "Correct"
                      : "Incorrect";

                return (
                  <article key={question.question_id} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-800">
                          {group.section}
                        </p>
                        <h4 className="mt-1 text-lg font-semibold text-slate-950">{title}</h4>
                        <p className="mt-1 text-xs text-slate-500">{question.question_id}</p>
                      </div>
                      <div className="grid gap-2 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2.5 py-1">
                          <ChevronRight size={13} />
                          Status {question.status || "-"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2.5 py-1">
                          <Gauge size={13} />
                          Runs {question.run_count || 0} | Submits {question.submit_count || 0}
                        </span>
                        {group.section === "MCQ" ? (
                          <span className="inline-flex items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2.5 py-1">
                            <GraduationCap size={13} />
                            MCQ {mcqScoreLabel}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-[8px] border border-slate-200 bg-white px-2.5 py-1">
                            <GraduationCap size={13} />
                            Final {score(evaluation?.final_score)} | Deterministic {score(evaluation?.deterministic_score)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                      <div className="grid gap-4">
                        <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2 text-slate-900">
                            <FileCode2 size={16} />
                            <p className="text-sm font-semibold">Submitted Answer</p>
                          </div>
                          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-slate-950 p-3 font-mono text-xs leading-6 text-slate-100">
                            {question.answer_text || "-"}
                          </pre>
                        </div>

                        {group.section === "MCQ" ? (
                          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                            <div className="flex items-center gap-2 text-slate-900">
                              <CheckCircle2 size={16} />
                              <p className="text-sm font-semibold">MCQ Evidence</p>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-slate-700">
                              <p>Selected options: {asStringArray(mcq?.selected_options).join(", ") || "-"}</p>
                              <p>Correct: {mcq?.is_correct === null || mcq?.is_correct === undefined ? "-" : mcq.is_correct ? "Yes" : "No"}</p>
                            </div>
                          </div>
                        ) : null}

                        {showDsaComplexity ? (
                          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                            <div className="flex items-center gap-2 text-slate-900">
                              <Gauge size={16} />
                              <p className="text-sm font-semibold">DSA Complexity</p>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Time Complexity</p>
                                <p className="mt-2 text-sm font-semibold text-slate-950">
                                  {outputText(evaluationOutput, "likely_time_complexity")}
                                </p>
                                <p className="mt-1 text-xs text-slate-600">
                                  Score {outputScore(evaluationOutput, "time_complexity_score")}
                                </p>
                              </div>
                              <div className="rounded-[8px] border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Space Complexity</p>
                                <p className="mt-2 text-sm font-semibold text-slate-950">
                                  {outputText(evaluationOutput, "likely_space_complexity")}
                                </p>
                                <p className="mt-1 text-xs text-slate-600">
                                  Score {outputScore(evaluationOutput, "space_complexity_score")}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {(group.section === "DSA" || group.section === "OOPs") && codeRun ? (
                          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                            <div className="flex items-center gap-2 text-slate-900">
                              <Braces size={16} />
                              <p className="text-sm font-semibold">Compiler Snapshot</p>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-slate-700">
                              <p>Language: {codeRun.language || question.selected_language || "-"}</p>
                              <p>Run type: {codeRun.run_type || "-"}</p>
                              <p>Status: {codeRun.status || "-"}</p>
                              <p>
                                Open tests: {codeRun.open_tests_passed ?? "-"} / {codeRun.open_tests_total ?? "-"}
                              </p>
                              <p>
                                Hidden tests: {codeRun.hidden_tests_passed ?? "-"} / {codeRun.hidden_tests_total ?? "-"}
                              </p>
                            </div>
                            <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-slate-950 p-3 font-mono text-xs leading-6 text-slate-100">
                              {stringify(codeRun.raw_provider_response)}
                            </pre>
                          </div>
                        ) : null}

                        {group.section === "SQL" && sqlRun ? (
                          <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                            <div className="flex items-center gap-2 text-slate-900">
                              <Database size={16} />
                              <p className="text-sm font-semibold">SQL Snapshot</p>
                            </div>
                            <div className="mt-3 grid gap-2 text-sm text-slate-700">
                              <p>Run type: {sqlRun.run_type || "-"}</p>
                              <p>Rows returned: {sqlRun.row_count ?? 0}</p>
                              <p>Error: {sqlRun.error_text || "None"}</p>
                            </div>
                            <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-slate-950 p-3 font-mono text-xs leading-6 text-slate-100">
                              {stringify(sqlRun.comparison_result)}
                            </pre>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-4">
                        <div className="rounded-[8px] border border-slate-200 bg-white p-3">
                          <div className="flex items-center gap-2 text-slate-900">
                            <BadgeCheck size={16} />
                            <p className="text-sm font-semibold">Evaluation Summary</p>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-slate-700">
                            <p>Marked for review: {question.marked_for_review ? "Yes" : "No"}</p>
                            <p>Last autosaved: {formatDate(question.last_autosaved_at)}</p>
                            <p>Selected language: {question.selected_language || "-"}</p>
                          </div>
                          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-700">
                            {stringify(evaluationOutput || evaluation?.ai_evaluation || "-")}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <ShieldAlert size={18} />
          <h3 className="font-semibold">Report JSON Snapshot</h3>
        </div>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">
          {stringify(report.report_json)}
        </pre>
      </section>
    </div>
  );
}
