import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarClock,
  Code2,
  Database,
  GraduationCap,
  ShieldAlert,
  TrendingUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

type Params = Promise<{ studentId: string }>;

type ReportRow = {
  id: string;
  attempt_id: string | null;
  student_id: string | null;
  assessment_title: string | null;
  marks_score: number | null;
  capability_score: number | null;
  dsa_score: number | null;
  sql_score: number | null;
  oops_score: number | null;
  mcq_score: number | null;
  hidden_test_pass_rate: number | null;
  brute_force_risk: string | null;
  hardcoding_risk: string | null;
  readiness_label: string | null;
  readiness_bucket: string | null;
  strongest_section: string | null;
  weakest_section: string | null;
  training_priority: string | null;
  teacher_action: string | null;
  faculty_insight: string | null;
  company_recommendation: string | null;
  created_at: string | null;
};

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

function normalizeRisk(value: string | null | undefined) {
  const risk = String(value || "").trim().toLowerCase();
  if (risk === "high") return "High";
  if (risk === "medium") return "Medium";
  return "Low";
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

function average(rows: ReportRow[], key: keyof ReportRow) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + score(row[key] as number | null), 0) / rows.length);
}

export default async function StudentReportProfilePage({
  params,
}: {
  params: Params;
}) {
  const { studentId } = await params;
  const { supabase } = await requireAdmin();

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
          "hidden_test_pass_rate",
          "brute_force_risk",
          "hardcoding_risk",
          "readiness_label",
          "readiness_bucket",
          "strongest_section",
          "weakest_section",
          "training_priority",
          "teacher_action",
          "faculty_insight",
          "company_recommendation",
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
  const batchName = activeBatch?.name || "-";
  const collegeName = activeBatch?.college_id ? collegeById.get(activeBatch.college_id) || "-" : "-";

  const latestReport = reports[0] || null;
  const latestBucket = latestReport
    ? normalizeBucket(latestReport.readiness_bucket, latestReport.readiness_label)
    : "Training Needed";
  const readyCount = reports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Ready").length;
  const trainingCount = reports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Training Needed").length;
  const failedCount = reports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Failed").length;
  const highBruteforceCount = reports.filter((report) => normalizeRisk(report.brute_force_risk) === "High").length;
  const highHardcodingCount = reports.filter((report) => normalizeRisk(report.hardcoding_risk) === "High").length;

  const sectionAverages = [
    { label: "DSA", value: average(reports, "dsa_score") },
    { label: "SQL", value: average(reports, "sql_score") },
    { label: "OOPs", value: average(reports, "oops_score") },
    { label: "MCQ", value: average(reports, "mcq_score") },
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Student Profile
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">
              {profile?.full_name || "Unnamed student"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{profile?.email || studentId}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                Batch {batchName}
              </span>
              <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                College {collegeName}
              </span>
              <span className={`rounded-[8px] border px-3 py-2 font-semibold ${readinessClasses(latestBucket)}`}>
                {latestBucket}
              </span>
            </div>
          </div>
          <Link
            href="/admin/reports/students"
            className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Students
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Attempts</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{reports.length}</p>
          <p className="mt-2 text-xs text-slate-500">Submitted assessment reports</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Latest / Best Score</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {latestReport ? `${score(latestReport.marks_score)} / ${Math.max(...reports.map((report) => score(report.marks_score)))}` : "0 / 0"}
          </p>
          <p className="mt-2 text-xs text-slate-500">Latest marks score versus best attempt</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Avg Capability</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{average(reports, "capability_score")}</p>
          <p className="mt-2 text-xs text-slate-500">Average capability across all attempts</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Avg Hidden Tests</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{average(reports, "hidden_test_pass_rate")}</p>
          <p className="mt-2 text-xs text-slate-500">Hidden test reliability over time</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <TrendingUp size={18} />
            <h3 className="font-semibold">Readiness Progression</h3>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="flex items-center justify-between rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
              <span>Ready</span>
              <span>{readyCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800">
              <span>Training Needed</span>
              <span>{trainingCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-[8px] border border-red-200 bg-red-50 px-3 py-3 text-sm font-semibold text-red-800">
              <span>Failed</span>
              <span>{failedCount}</span>
            </div>
          </div>
        </article>

        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <ShieldAlert size={18} />
            <h3 className="font-semibold">Risk History</h3>
          </div>
          <div className="mt-5 grid gap-3">
            <div className="flex items-center justify-between rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
              <span className="font-medium text-slate-900">High brute-force attempts</span>
              <span className="font-semibold text-slate-700">{highBruteforceCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
              <span className="font-medium text-slate-900">High hardcoding attempts</span>
              <span className="font-semibold text-slate-700">{highHardcodingCount}</span>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
              Latest training priority: <span className="font-medium text-slate-900">{latestReport?.training_priority || "-"}</span>
            </div>
          </div>
        </article>

        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-950">
            <BadgeCheck size={18} />
            <h3 className="font-semibold">Latest Guidance</h3>
          </div>
          <div className="mt-5 grid gap-3 text-sm text-slate-700">
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Teacher Action</p>
              <p className="mt-2 leading-6">{latestReport?.teacher_action || "-"}</p>
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="font-medium text-slate-900">Recommendation</p>
              <p className="mt-2 leading-6">{latestReport?.company_recommendation || "-"}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Section Trends</h3>
          <div className="mt-5 grid gap-3">
            {sectionAverages.map((item) => {
              const Icon = sectionIcon(item.label);
              return (
                <div key={item.label} className="flex items-center justify-between rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <Icon size={15} />
                    {item.label}
                  </span>
                  <span className="text-lg font-semibold text-slate-950">{item.value}</span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-950">Assessment Attempts</h3>
              <p className="mt-1 text-sm text-slate-600">Latest first. Each row is ready for the Phase 5 attempt report card.</p>
            </div>
            <CalendarClock className="text-slate-400" size={18} />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Assessment</th>
                  <th className="px-4 py-3 font-medium">Scores</th>
                  <th className="px-4 py-3 font-medium">Readiness</th>
                  <th className="px-4 py-3 font-medium">Strong / Weak</th>
                  <th className="px-4 py-3 font-medium">Risk</th>
                  <th className="px-4 py-3 font-medium">Faculty Insight</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.map((report) => {
                  const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
                  const StrongIcon = sectionIcon(report.strongest_section || "");
                  const WeakIcon = sectionIcon(report.weakest_section || "");

                  return (
                    <tr key={report.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-950">{report.assessment_title || "Untitled assessment"}</p>
                        {report.attempt_id ? (
                          <Link
                            href={`/admin/reports/students/${studentId}/attempts/${report.attempt_id}`}
                            className="mt-2 inline-flex rounded-[8px] border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Open Attempt
                          </Link>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <div className="grid gap-1 text-xs text-slate-600">
                          <span className="font-semibold text-slate-950">Marks {score(report.marks_score)} | Capability {score(report.capability_score)}</span>
                          <span>DSA {score(report.dsa_score)} | SQL {score(report.sql_score)} | OOPs {score(report.oops_score)} | MCQ {score(report.mcq_score)}</span>
                          <span>Hidden tests {score(report.hidden_test_pass_rate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${readinessClasses(bucket)}`}>
                          {bucket}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="grid gap-2">
                          <span className="inline-flex w-fit items-center gap-1 rounded-[8px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            <StrongIcon size={13} />
                            {report.strongest_section || "-"}
                          </span>
                          <span className="inline-flex w-fit items-center gap-1 rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            <WeakIcon size={13} />
                            {report.weakest_section || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="grid gap-2">
                          <span className="inline-flex w-fit items-center gap-1 rounded-[8px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            <AlertTriangle size={13} />
                            BF {normalizeRisk(report.brute_force_risk)}
                          </span>
                          <span className="inline-flex w-fit items-center gap-1 rounded-[8px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            <Building2 size={13} />
                            HC {normalizeRisk(report.hardcoding_risk)}
                          </span>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-4 leading-6 text-slate-700">{report.faculty_insight || "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(report.created_at)}</td>
                    </tr>
                  );
                })}
                {reports.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                      No assessment attempts found for this student.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
