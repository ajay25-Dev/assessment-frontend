import {
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Gauge,
  GraduationCap,
  ShieldAlert,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminUi } from "@/lib/admin/ui";
import {
  asStringArray,
  buildNextBestStep,
  clampScore,
  extractLatestSkillScores,
  formatDateTime,
  interpretScoreBand,
  flattenNestedReportData,
  normalizeBucket,
  normalizeReadinessLabel,
  normalizeRisk,
  readinessClasses,
  ReportRow,
  riskClasses,
  SkillScoreRow,
} from "@/lib/admin/student-report";
import { requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

type Params = Promise<{ studentId: string }>;

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
};

type BatchStudentRow = {
  batch_id: string | null;
  student_id: string | null;
  created_at: string | null;
};

type BatchRow = {
  id: string;
  name: string | null;
  college_id: string | null;
};

type CollegeRow = {
  id: string;
  name: string | null;
};

function sectionIcon(section: string) {
  const normalized = section.trim().toLowerCase();
  if (normalized.includes("dsa")) return BookOpen;
  if (normalized.includes("sql")) return Building2;
  if (normalized.includes("oop")) return Wrench;
  if (normalized.includes("mcq")) return GraduationCap;
  if (normalized.includes("hidden")) return ShieldAlert;
  if (normalized.includes("complex")) return Gauge;
  return Target;
}

function scoreTone(value: number) {
  if (value <= 30) return "border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] text-[var(--status-critical-text)]";
  if (value <= 60) return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  if (value <= 80) return "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]";
  return "border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] text-[var(--status-ready-text)]";
}

function scoreBarTone(value: number) {
  if (value <= 30) return "bg-red-500";
  if (value <= 60) return "bg-amber-500";
  if (value <= 80) return "bg-sky-500";
  return "bg-emerald-500";
}

function riskLabel(label: string, value: string) {
  return `${label}: ${value}`;
}

function pillTone(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("immediate support")) return "border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] text-[var(--status-critical-text)]";
  if (normalized.includes("practice")) return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
  if (normalized.includes("ready")) return "border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] text-[var(--status-ready-text)]";
  return "border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] text-slate-700";
}

const sectionSurface = adminUi.sectionCard;
const softSurface = adminUi.softCard;
const chipSurface = adminUi.fieldChip;
const sectionTitle = adminUi.sectionTitle;
const secondaryAction =
  "inline-flex items-center justify-center gap-2 rounded-[12px] border border-[var(--color-border-strong)] bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950";
const primaryAction =
  "inline-flex items-center justify-center gap-2 rounded-[12px] border border-[var(--color-primary-600)] bg-[var(--color-primary-600)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-primary-700)]";

export default async function StudentReportProfilePage({
  params,
}: {
  params: Params;
}) {
  const { studentId } = await params;
  const { supabase, profile: adminProfile } = await requireAdmin();

  const [
    { data: reportRows, error: reportError },
    { data: profileRow },
    { data: assignmentRows },
    { data: batchRows },
    { data: collegeRows },
  ] = await Promise.all([
    supabase
      .from("student_assessment_reports")
      .select(
        [
          "id",
          "attempt_id",
          "student_id",
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
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id,email,full_name").eq("id", studentId).maybeSingle(),
    supabase.from("batch_students").select("batch_id,student_id,created_at").eq("student_id", studentId).order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name,college_id").order("name"),
    supabase.from("colleges").select("id,name").order("name"),
  ]);

  if (reportError) {
    throw new Error(`Could not load student profile reports: ${reportError.message}`);
  }

  const reports = (reportRows || []) as unknown as ReportRow[];
  const profile = (profileRow || null) as ProfileRow | null;
  const assignments = (assignmentRows || []) as unknown as BatchStudentRow[];
  const batches = (batchRows || []) as unknown as BatchRow[];
  const colleges = (collegeRows || []) as unknown as CollegeRow[];

  if (!profile && reports.length === 0) notFound();

  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const collegeById = new Map(colleges.map((college) => [college.id, college.name || ""]));
  const activeAssignment = assignments[0] || null;
  const activeBatch = activeAssignment?.batch_id ? batchById.get(activeAssignment.batch_id) : null;
  const batchName = activeBatch?.name || "Not available";
  const collegeName = activeBatch?.college_id ? collegeById.get(activeBatch.college_id) || "Not available" : "Not available";

  const latestReport = reports[0] || null;
  const latestBucket = latestReport ? normalizeBucket(latestReport.readiness_bucket, latestReport.readiness_label) : "Training Needed";
  const latestReadinessLabel = normalizeReadinessLabel(latestBucket);
  const latestScore = clampScore(latestReport?.marks_score);
  const skillReadiness = clampScore(latestReport?.problem_solving_score ?? latestReport?.capability_score);
  const latestAttemptTime = formatDateTime(latestReport?.created_at);
  const readyCount = reports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Ready").length;
  const trainingCount = reports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Training Needed").length;
  const failedCount = reports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Failed").length;
  const skillScores: SkillScoreRow[] = latestReport ? extractLatestSkillScores(latestReport, latestReport.report_json) : [];
  const detailedStrengths = asStringArray(latestReport?.detailed_strengths);
  const detailedWeaknesses = asStringArray(latestReport?.detailed_weaknesses);
  const learningActions = asStringArray(latestReport?.next_3_learning_actions);
  const nextBestStep = latestReport ? buildNextBestStep(latestReport) : "";
  const downloadHref = latestReport?.attempt_id ? `/admin/reports/students/${studentId}/attempts/${latestReport.attempt_id}/pdf` : null;
  const readinessReasonPairs = flattenNestedReportData(latestReport?.readiness_reason);
  const riskSummaryPairs = flattenNestedReportData(latestReport?.risk_summary);

  const submissionRows = reports.map((report) => {
    const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
    const readiness = normalizeReadinessLabel(bucket);
    const openHref = report.attempt_id ? `/admin/reports/students/${studentId}/attempts/${report.attempt_id}` : null;
    const pdfHref = report.attempt_id ? `/admin/reports/students/${studentId}/attempts/${report.attempt_id}/pdf` : null;
    return {
      id: report.id,
      assessment: report.assessment_title || "Untitled assessment",
      openHref,
      pdfHref,
      overall: clampScore(report.marks_score),
      skillReadiness: clampScore(report.problem_solving_score ?? report.capability_score),
      dsa: clampScore(report.dsa_score),
      sql: clampScore(report.sql_score),
      oops: clampScore(report.oops_score),
      mcq: clampScore(report.mcq_score),
      readiness,
      basicFoundationRisk: normalizeRisk(report.brute_force_risk),
      higherConceptRisk: normalizeRisk(report.hardcoding_risk),
      teacherInsight: report.faculty_insight || report.company_recommendation || "Not available",
      submittedAt: formatDateTime(report.created_at),
      strongest: report.strongest_section || "Not available",
      weakest: report.weakest_section || "Not available",
      trainingPriority: report.training_priority || "Not available",
      trainingRecommendation: report.training_recommendation || "Not available",
      teacherAction: report.teacher_action || "Not available",
    };
  });

  return (
    <div className="grid gap-6">
      <section className={sectionSurface}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className={adminUi.eyebrow}>
              Student Profile
            </p>
            <h1 className={`mt-2 ${adminUi.pageTitle}`}>
              Student Profile
            </h1>
            <p className={`mt-3 sm:text-base ${adminUi.subtleText}`}>
              Review student readiness, risks, guidance, and submission history.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            {adminProfile?.email ? (
              <span className="inline-flex max-w-full truncate rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-3 py-2 text-xs font-medium text-slate-600">
                {adminProfile.email}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className={sectionSurface}>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2 text-sm text-slate-700">
              <span className={chipSurface}>
                {profile?.full_name || "Unnamed student"}
              </span>
              <span className={chipSurface}>
                {profile?.email || studentId}
              </span>
              <span className={chipSurface}>
                Batch: {batchName}
              </span>
              <span className={chipSurface}>
                College: {collegeName}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className={`rounded-[18px] border px-4 py-3 ${readinessClasses(latestBucket)}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">Current Status</p>
                <p className="mt-2 text-xl font-semibold">{latestReadinessLabel}</p>
              </div>
              <div className={softSurface}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest Score</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{latestScore}</p>
              </div>
              <div className="rounded-[18px] border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Problem Solving Score</p>
                <p className="mt-2 text-xl font-semibold text-emerald-950">{skillReadiness}</p>
              </div>
              <div className={softSurface}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Latest Attempt</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{latestAttemptTime}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={softSurface}>
                <p className="text-sm font-semibold text-slate-900">Current readiness</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {latestReadinessLabel} based on the latest evaluated submission.
                </p>
              </div>
              <div className={softSurface}>
                <p className="text-sm font-semibold text-slate-900">Latest attempt time</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{latestAttemptTime}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <div className={softSurface}>
              <p className="text-sm font-semibold text-slate-900">Quick actions</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/admin/reports/students"
                  className={adminUi.secondaryButton}
                >
                  <ArrowLeft size={16} />
                  Back to Students
                </Link>
                {downloadHref ? (
                  <Link
                    href={downloadHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={adminUi.primaryButton}
                  >
                    <Download size={16} />
                    Download Student Report
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-[20px] border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] p-4">
              <p className="text-sm font-semibold text-emerald-900">Summary</p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                {latestReport?.student_summary || "The latest submission has no dedicated student summary available."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionSurface}>
        <div className="flex items-center gap-2 text-slate-950">
          <Sparkles size={18} className="text-emerald-700" />
          <h2 className={sectionTitle}>Latest AI Guidance</h2>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className={softSurface}>
            <p className="text-sm font-semibold text-slate-900">Teacher Action</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {latestReport?.teacher_action || "Not available"}
            </p>
          </div>
          <div className={softSurface}>
            <p className="text-sm font-semibold text-slate-900">Recommendation</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {latestReport?.training_recommendation || latestReport?.company_recommendation || "Not available"}
            </p>
          </div>
          <div className={softSurface}>
            <p className="text-sm font-semibold text-slate-900">Next Best Step</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {nextBestStep || "Not available"}
            </p>
          </div>
          <div className={softSurface}>
            <p className="text-sm font-semibold text-slate-900">Current Training Priority</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">
              {latestReport?.training_priority || "Not available"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className={sectionSurface}>
          <div className="flex items-center gap-2 text-slate-950">
            <BadgeCheck size={18} className="text-emerald-700" />
            <h2 className={sectionTitle}>Strengths & Learning Gaps</h2>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[18px] border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] p-4">
              <p className="text-sm font-semibold text-emerald-900">Strengths</p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                {latestReport?.strongest_section || "Not available"}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-emerald-900">
                {(detailedStrengths.length ? detailedStrengths : ["Not enough evidence available"]).map((item) => (
                  <li key={item} className="rounded-[12px] border border-[var(--status-ready-border)] bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[18px] border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4">
              <p className="text-sm font-semibold text-amber-900">Learning Gaps</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                {latestReport?.weakest_section || "Not available"}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-amber-900">
                {(detailedWeaknesses.length ? detailedWeaknesses : ["Not enough evidence available"]).map((item) => (
                  <li key={item} className="rounded-[12px] border border-[var(--status-warning-border)] bg-white px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className={`mt-4 grid gap-3 ${softSurface} text-sm text-slate-700`}>
            <p className="font-semibold text-slate-900">Student Summary</p>
            <p className="leading-7">{latestReport?.student_summary || "Not available"}</p>
            <p className="font-semibold text-slate-900">Recommended Learning Actions</p>
            <div className="flex flex-wrap gap-2">
              {(learningActions.length ? learningActions : ["Not available"]).map((action) => (
                <span key={action} className="rounded-full border border-[var(--color-border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {action}
                </span>
              ))}
            </div>
          </div>
        </article>

        <article className="grid gap-4">
          <section className={sectionSurface}>
            <div className="flex items-center gap-2 text-slate-950">
              <CalendarClock size={18} className="text-emerald-700" />
              <h2 className={sectionTitle}>Readiness History</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] p-4">
                <p className="text-sm font-semibold text-emerald-900">Ready for Next Level</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-950">{readyCount}</p>
              </div>
              <div className="rounded-[18px] border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4">
                <p className="text-sm font-semibold text-amber-900">Needs Practice</p>
                <p className="mt-2 text-3xl font-semibold text-amber-950">{trainingCount}</p>
              </div>
              <div className="rounded-[18px] border border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] p-4">
                <p className="text-sm font-semibold text-red-900">Needs Immediate Support</p>
                <p className="mt-2 text-3xl font-semibold text-red-950">{failedCount}</p>
              </div>
            </div>
          </section>

          <section className={sectionSurface}>
            <div className="flex items-center gap-2 text-slate-950">
              <ShieldAlert size={18} className="text-emerald-700" />
              <h2 className={sectionTitle}>Risk Signals</h2>
            </div>
            <div className="mt-5 grid gap-3">
              <div className={softSurface}>
                <p className="text-sm font-semibold text-slate-900">{riskLabel("Brute-force risk", latestReport?.brute_force_risk || "Not available")}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Basic Foundation Risk: {normalizeRisk(latestReport?.brute_force_risk)}
                </p>
              </div>
              <div className={softSurface}>
                <p className="text-sm font-semibold text-slate-900">{riskLabel("Hardcoding risk", latestReport?.hardcoding_risk || "Not available")}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Higher Concept Risk: {normalizeRisk(latestReport?.hardcoding_risk)}
                </p>
              </div>
              <div className={softSurface}>
                <p className="text-sm font-semibold text-slate-900">Current training priority</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {latestReport?.training_priority || "Not available"}
                </p>
              </div>
            </div>
          </section>
        </article>
      </section>

      <section className={sectionSurface}>
        <div className="flex items-center gap-2 text-slate-950">
          <Gauge size={18} className="text-emerald-700" />
          <h2 className={sectionTitle}>Skill Performance Breakdown</h2>
        </div>
        <p className={`mt-2 ${adminUi.subtleText}`}>
          Every available score is grouped into a teacher-friendly interpretation.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {skillScores.map((item) => {
            const Icon = sectionIcon(item.label);
            const tone = scoreTone(item.value);
            const barTone = scoreBarTone(item.value);
            return (
              <article key={item.label} className={`rounded-[18px] border p-4 shadow-[var(--shadow-card)] ${tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] opacity-80">{item.label}</p>
                    <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                  </div>
                  <span className="rounded-[12px] border border-white/70 bg-white/70 p-2 text-slate-800">
                    <Icon size={16} />
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
                  <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.min(item.value, 100)}%` }} />
                </div>
                <p className="mt-3 text-sm font-semibold">
                  Interpretation: {interpretScoreBand(item.value)}
                </p>
                <p className="mt-2 text-sm leading-6 opacity-90">{item.helper}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={sectionSurface}>
        <div className="flex items-center gap-2 text-slate-950">
          <ExternalLink size={18} className="text-emerald-700" />
          <h2 className={sectionTitle}>Submission History</h2>
        </div>
        <p className={`mt-2 ${adminUi.subtleText}`}>
          Open each submission to see the full student input, AI output, and scoring details.
        </p>

        <div className="mt-5 hidden overflow-x-auto rounded-[18px] border border-[var(--color-border-subtle)] lg:block">
          <table className="w-full min-w-[1280px] text-left text-sm">
            <thead className="bg-[var(--color-bg-muted)] text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Assessment</th>
                <th className="px-4 py-3 font-medium">Overall Performance</th>
                <th className="px-4 py-3 font-medium">Skill Breakdown</th>
                <th className="px-4 py-3 font-medium">Readiness</th>
                <th className="px-4 py-3 font-medium">Risk Signals</th>
                <th className="px-4 py-3 font-medium">AI Teacher Insight</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissionRows.map((report) => (
                <tr key={report.id} className="align-top transition hover:bg-[var(--color-bg-muted)]">
                  <td className="px-4 py-4">
                    <div className="grid gap-2">
                      <p className="font-semibold text-slate-950">{report.assessment}</p>
                      {report.openHref ? (
                        <Link
                          href={report.openHref}
                          className={secondaryAction}
                        >
                          Open full submission
                          <ChevronRight size={14} />
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">No submission link available</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 font-semibold text-slate-800">
                          Overall {report.overall}
                        </span>
                        <span className="rounded-full border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] px-2.5 py-1 font-semibold text-emerald-900">
                          Problem Solving Score {report.skillReadiness}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid gap-2 text-xs font-semibold">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-slate-700">DSA {report.dsa}</span>
                        <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-slate-700">SQL {report.sql}</span>
                        <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-slate-700">OOPs {report.oops}</span>
                        <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-slate-700">MCQ {report.mcq}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${pillTone(report.readiness)}`}>
                      {report.readiness}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="grid gap-2">
                      <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClasses(report.basicFoundationRisk)}`}>
                        Basic Foundation Risk: {report.basicFoundationRisk}
                      </span>
                      <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClasses(report.higherConceptRisk)}`}>
                        Higher Concept Risk: {report.higherConceptRisk}
                      </span>
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-4 leading-6 text-slate-700">
                    <div className="grid gap-2">
                      <p>{report.teacherInsight}</p>
                      <p className="text-xs text-slate-500">
                        Strengths: {report.strongest} | Learning gaps: {report.weakest}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{report.submittedAt}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {report.openHref ? (
                        <Link
                          href={report.openHref}
                          className={secondaryAction}
                        >
                          Open Report
                        </Link>
                      ) : null}
                      {report.pdfHref ? (
                        <Link
                          href={report.pdfHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={primaryAction}
                        >
                          Download PDF
                        </Link>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {submissionRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                    No assessment attempts found for this student.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 grid gap-4 lg:hidden">
          {submissionRows.map((report) => (
            <article key={report.id} className="rounded-[20px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-950">{report.assessment}</p>
                  {report.openHref ? (
                    <Link
                      href={report.openHref}
                      className={`mt-2 ${secondaryAction}`}
                    >
                      Open full submission
                      <ChevronRight size={14} />
                    </Link>
                  ) : null}
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${pillTone(report.readiness)}`}>
                  {report.readiness}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-2 rounded-[16px] border border-[var(--color-border-subtle)] bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-xs font-semibold text-slate-800">
                      Overall {report.overall}
                    </span>
                    <span className="rounded-full border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] px-2.5 py-1 text-xs font-semibold text-emerald-900">
                      Problem Solving Score {report.skillReadiness}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-slate-700">DSA {report.dsa}</span>
                    <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-slate-700">SQL {report.sql}</span>
                    <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-slate-700">OOPs {report.oops}</span>
                    <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1 text-slate-700">MCQ {report.mcq}</span>
                  </div>
                </div>

                <div className="grid gap-2 rounded-[16px] border border-[var(--color-border-subtle)] bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Risk Signals</p>
                  <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClasses(report.basicFoundationRisk)}`}>
                    Basic Foundation Risk: {report.basicFoundationRisk}
                  </span>
                  <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${riskClasses(report.higherConceptRisk)}`}>
                    Higher Concept Risk: {report.higherConceptRisk}
                  </span>
                </div>

                <div className="grid gap-2 rounded-[16px] border border-[var(--color-border-subtle)] bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">AI Teacher Insight</p>
                  <p className="text-sm leading-6 text-slate-700">{report.teacherInsight}</p>
                  <p className="text-xs text-slate-500">Strengths: {report.strongest} | Learning gaps: {report.weakest}</p>
                </div>

                <div className="grid gap-2 rounded-[16px] border border-[var(--color-border-subtle)] bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Submitted</p>
                  <p className="text-sm text-slate-700">{report.submittedAt}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {report.openHref ? (
                    <Link
                      href={report.openHref}
                      className={secondaryAction}
                    >
                      Open Report
                    </Link>
                  ) : null}
                  {report.pdfHref ? (
                    <Link
                      href={report.pdfHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={primaryAction}
                    >
                      Download PDF
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {submissionRows.length === 0 ? (
            <div className="rounded-[20px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] p-4 text-center text-sm text-slate-500">
              No assessment attempts found for this student.
            </div>
          ) : null}
        </div>
      </section>

      {reports.length > 0 ? (
        <section className={sectionSurface}>
          <div className="flex items-center gap-2 text-slate-950">
            <ChevronDown size={18} className="text-emerald-700" />
            <h2 className={sectionTitle}>Latest Report Notes</h2>
          </div>
          <div className="mt-4 grid gap-4 text-sm leading-7 text-slate-700">
            <div className="grid gap-3 lg:grid-cols-2">
              <p className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-3">
                <span className="font-semibold text-slate-900">Readiness status:</span> {latestReadinessLabel}
              </p>
              <p className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-3">
                <span className="font-semibold text-slate-900">Teacher action:</span> {latestReport?.teacher_action || "Not available"}
              </p>
              <p className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-3">
                <span className="font-semibold text-slate-900">Training recommendation:</span> {latestReport?.training_recommendation || "Not available"}
              </p>
              <p className="rounded-[14px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-4 py-3">
                <span className="font-semibold text-slate-900">AI teacher insight:</span> {latestReport?.faculty_insight || "Not available"}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={softSurface}>
                <p className="font-semibold text-slate-900">Readiness reason</p>
                <div className="mt-3 grid gap-2">
                  {(readinessReasonPairs.length ? readinessReasonPairs : [{ label: "Readiness reason", value: "Not available", depth: 0 }]).map((item) => (
                    <div key={`${item.label}-${item.value}`} className="rounded-[12px] border border-[var(--color-border-subtle)] bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className={softSurface}>
                <p className="font-semibold text-slate-900">Risk summary</p>
                <div className="mt-3 grid gap-2">
                  {(riskSummaryPairs.length ? riskSummaryPairs : [{ label: "Risk summary", value: "Not available", depth: 0 }]).map((item) => (
                    <div key={`${item.label}-${item.value}`} className="rounded-[12px] border border-[var(--color-border-subtle)] bg-white px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}


