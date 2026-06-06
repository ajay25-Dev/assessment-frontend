import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Building2,
  CircleAlert,
  Code2,
  Database,
  Filter,
  GraduationCap,
  ShieldAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ReportRow = {
  id: string;
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
  compilation_behaviour: string | null;
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

type FilteredReport = ReportRow & {
  student_name: string;
  student_email: string;
  batch_name: string;
  college_name: string;
};

type ReadinessBucket = "Ready" | "Training Needed" | "Failed";

function asText(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function score(value: number | null | undefined) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function average(rows: FilteredReport[], key: keyof FilteredReport) {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + score(row[key] as number | null), 0) / rows.length);
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

function normalizeCompilation(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("fail")) return "Failed";
  if (normalized.includes("warn")) return "Warnings";
  return "Clean";
}

function normalizeBucket(value: string | null | undefined, label: string | null | undefined): ReadinessBucket {
  const bucket = String(value || "").trim().toLowerCase();
  if (bucket === "ready") return "Ready";
  if (bucket === "training needed") return "Training Needed";
  if (bucket === "failed") return "Failed";

  const readiness = String(label || "").trim().toLowerCase();
  if (readiness.includes("risk") || readiness.includes("fail")) return "Failed";
  if (readiness.includes("need") || readiness.includes("practice")) return "Training Needed";
  return "Ready";
}

function riskClasses(value: string | null | undefined) {
  const risk = normalizeRisk(value);
  if (risk === "High") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
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

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

  const assessmentFilter = asText(params.assessment);
  const collegeFilter = asText(params.college);
  const batchFilter = asText(params.batch);
  const readinessFilter = asText(params.readiness);
  const fromFilter = asText(params.from);
  const toFilter = asText(params.to);

  const [
    { data: reportRows, error: reportError },
    { data: profileRows },
    { data: assignmentRows },
    { data: batchRows },
    { data: collegeRows },
  ] = await Promise.all([
    supabase
      .from("student_assessment_reports")
      .select(
        [
          "id",
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
          "compilation_behaviour",
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
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("profiles").select("id,email,full_name"),
    supabase.from("batch_students").select("batch_id,student_id,created_at").order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name,college_id").order("name"),
    supabase.from("colleges").select("id,name").order("name"),
  ]);

  if (reportError) {
    throw new Error(`Could not load assessment reports: ${reportError.message}`);
  }

  const reports = (reportRows || []) as unknown as ReportRow[];
  const profiles = (profileRows || []) as unknown as ProfileRow[];
  const assignments = (assignmentRows || []) as unknown as BatchStudentRow[];
  const batches = (batchRows || []) as unknown as BatchRow[];
  const colleges = (collegeRows || []) as unknown as CollegeRow[];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));
  const collegeById = new Map(colleges.map((college) => [college.id, college.name || ""]));
  const latestAssignmentByStudentId = new Map<string, BatchStudentRow>();

  for (const assignment of assignments) {
    if (!assignment.student_id || latestAssignmentByStudentId.has(assignment.student_id)) continue;
    latestAssignmentByStudentId.set(assignment.student_id, assignment);
  }

  const enrichedReports = reports.map((report) => {
    const profile = report.student_id ? profileById.get(report.student_id) : null;
    const assignment = report.student_id ? latestAssignmentByStudentId.get(report.student_id) : null;
    const batch = assignment?.batch_id ? batchById.get(assignment.batch_id) : null;
    const collegeName = batch?.college_id ? collegeById.get(batch.college_id) || "-" : "-";

    return {
      ...report,
      student_name: profile?.full_name || "Unnamed student",
      student_email: profile?.email || report.student_id || "-",
      batch_name: batch?.name || "-",
      college_name: collegeName,
    } satisfies FilteredReport;
  });

  const filteredReports = enrichedReports.filter((report) => {
    const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
    const createdAt = report.created_at ? new Date(report.created_at) : null;
    const fromDate = fromFilter ? new Date(`${fromFilter}T00:00:00`) : null;
    const toDate = toFilter ? new Date(`${toFilter}T23:59:59`) : null;

    if (assessmentFilter && report.assessment_title !== assessmentFilter) return false;
    if (collegeFilter && report.college_name !== collegeFilter) return false;
    if (batchFilter && report.batch_name !== batchFilter) return false;
    if (readinessFilter && bucket !== readinessFilter) return false;
    if (fromDate && createdAt && createdAt < fromDate) return false;
    if (toDate && createdAt && createdAt > toDate) return false;
    return true;
  });

  const readinessCounts: Record<ReadinessBucket, number> = {
    Ready: 0,
    "Training Needed": 0,
    Failed: 0,
  };

  const weakestSectionCounts = new Map<string, number>();
  for (const report of filteredReports) {
    const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
    readinessCounts[bucket] += 1;
    const weakest = report.weakest_section || "Unknown";
    weakestSectionCounts.set(weakest, (weakestSectionCounts.get(weakest) || 0) + 1);
  }

  const weakestSections = [...weakestSectionCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  const assessmentOptions = [...new Set(enrichedReports.map((report) => report.assessment_title || "Untitled assessment"))].sort();
  const collegeOptions = [...new Set(enrichedReports.map((report) => report.college_name).filter((item) => item && item !== "-"))].sort();
  const batchOptions = [...new Set(enrichedReports.map((report) => report.batch_name).filter((item) => item && item !== "-"))].sort();

  const statCards = [
    { label: "Filtered Reports", value: filteredReports.length, icon: BarChart3, note: "Rows matching current filters" },
    { label: "Avg Marks", value: average(filteredReports, "marks_score"), icon: GraduationCap, note: "Overall assessment output" },
    { label: "Avg Capability", value: average(filteredReports, "capability_score"), icon: BadgeCheck, note: "Problem-solving strength" },
    { label: "Avg Hidden Tests", value: average(filteredReports, "hidden_test_pass_rate"), icon: ShieldAlert, note: "Unseen-case reliability" },
  ];

  const healthCards = [
    { label: "Ready", value: readinessCounts.Ready, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    { label: "Training Needed", value: readinessCounts["Training Needed"], tone: "border-amber-200 bg-amber-50 text-amber-800" },
    { label: "Failed", value: readinessCounts.Failed, tone: "border-red-200 bg-red-50 text-red-800" },
    {
      label: "Compilation Failed",
      value: filteredReports.filter((report) => normalizeCompilation(report.compilation_behaviour) === "Failed").length,
      tone: "border-red-200 bg-red-50 text-red-800",
    },
    {
      label: "High Brute-force",
      value: filteredReports.filter((report) => normalizeRisk(report.brute_force_risk) === "High").length,
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    },
    {
      label: "High Hardcoding",
      value: filteredReports.filter((report) => normalizeRisk(report.hardcoding_risk) === "High").length,
      tone: "border-amber-200 bg-amber-50 text-amber-800",
    },
  ];

  const sectionAverages = [
    { label: "DSA", value: average(filteredReports, "dsa_score") },
    { label: "SQL", value: average(filteredReports, "sql_score") },
    { label: "OOPs", value: average(filteredReports, "oops_score") },
    { label: "MCQ", value: average(filteredReports, "mcq_score") },
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Reports
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Admin assessment analytics</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">
              Review readiness distribution, section strength, integrity risk, and recent outcomes across all submitted assessments.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/admin/reports/students"
              className="inline-flex items-center justify-center rounded-[8px] border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
            >
              Student Drill-Down
            </Link>
            <div className="rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-medium text-slate-900">
                <Filter size={16} />
                Active scope
              </div>
              <p className="mt-2">
                {assessmentFilter || "All assessments"} | {collegeFilter || "All colleges"} | {batchFilter || "All batches"} | {readinessFilter || "All readiness buckets"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-950">Filters</h3>
          <p className="mt-1 text-sm text-slate-600">Narrow the analytics view without leaving the admin workspace.</p>
        </div>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <select name="assessment" defaultValue={assessmentFilter} className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm">
            <option value="">All assessments</option>
            {assessmentOptions.map((assessment) => (
              <option key={assessment} value={assessment}>
                {assessment}
              </option>
            ))}
          </select>
          <select name="college" defaultValue={collegeFilter} className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm">
            <option value="">All colleges</option>
            {collegeOptions.map((college) => (
              <option key={college} value={college}>
                {college}
              </option>
            ))}
          </select>
          <select name="batch" defaultValue={batchFilter} className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm">
            <option value="">All batches</option>
            {batchOptions.map((batch) => (
              <option key={batch} value={batch}>
                {batch}
              </option>
            ))}
          </select>
          <select name="readiness" defaultValue={readinessFilter} className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm">
            <option value="">All readiness buckets</option>
            <option value="Ready">Ready</option>
            <option value="Training Needed">Training Needed</option>
            <option value="Failed">Failed</option>
          </select>
          <input name="from" type="date" defaultValue={fromFilter} className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
          <input name="to" type="date" defaultValue={toFilter} className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm" />
          <div className="md:col-span-2 xl:col-span-6 flex flex-wrap gap-2">
            <button className="rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
              Apply Filters
            </button>
            <a href="/admin/reports" className="rounded-[8px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Clear
            </a>
          </div>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{item.value}</p>
                  <p className="mt-2 text-xs text-slate-500">{item.note}</p>
                </div>
                <span className="rounded-[8px] border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
                  <Icon size={18} />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1.1fr_1fr]">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Readiness Distribution</h3>
          <div className="mt-5 grid gap-3">
            {healthCards.slice(0, 3).map((item) => (
              <div key={item.label} className={`flex items-center justify-between rounded-[8px] border px-3 py-3 text-sm font-semibold ${item.tone}`}>
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Risk Signals</h3>
          <div className="mt-5 grid gap-3">
            {healthCards.slice(3).map((item) => (
              <div key={item.label} className={`flex items-center justify-between rounded-[8px] border px-3 py-3 text-sm font-semibold ${item.tone}`}>
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Weakest Sections</h3>
          <div className="mt-5 grid gap-3">
            {weakestSections.length > 0 ? (
              weakestSections.map(([section, count]) => {
                const Icon = sectionIcon(section);
                return (
                  <div key={section} className="flex items-center justify-between rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
                    <span className="flex items-center gap-2 font-medium text-slate-900">
                      <Icon size={15} />
                      {section}
                    </span>
                    <span className="font-semibold text-slate-700">{count}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">No weakest-section data yet for the selected filters.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr]">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-950">Section Averages</h3>
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
              <h3 className="font-semibold text-slate-950">Latest Submissions</h3>
              <p className="mt-1 text-sm text-slate-600">Filtered report rows with readiness, risk, and training direction.</p>
            </div>
            <CircleAlert className="text-slate-400" size={18} />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Assessment</th>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Scores</th>
                  <th className="px-4 py-3 font-medium">Readiness</th>
                  <th className="px-4 py-3 font-medium">Weakest</th>
                  <th className="px-4 py-3 font-medium">Training Priority</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.slice(0, 50).map((report) => {
                  const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
                  return (
                    <tr key={report.id} className="align-top">
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-950">{report.student_name}</p>
                        <p className="mt-1 text-xs text-slate-500">{report.student_email}</p>
                        <p className="mt-1 text-xs text-slate-500">{report.college_name}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{report.assessment_title || "Untitled assessment"}</td>
                      <td className="px-4 py-4 text-slate-700">{report.batch_name}</td>
                      <td className="px-4 py-4">
                        <div className="grid gap-1 text-xs text-slate-600">
                          <span className="font-semibold text-slate-950">Marks {score(report.marks_score)} | Capability {score(report.capability_score)}</span>
                          <span>DSA {score(report.dsa_score)} | SQL {score(report.sql_score)} | OOPs {score(report.oops_score)} | MCQ {score(report.mcq_score)}</span>
                          <span>Hidden tests {score(report.hidden_test_pass_rate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="grid gap-2">
                          <span className={`inline-flex w-fit rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${readinessClasses(bucket)}`}>
                            {bucket}
                          </span>
                          <span className={`inline-flex w-fit items-center gap-1 rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${riskClasses(report.brute_force_risk)}`}>
                            <AlertTriangle size={13} />
                            BF {normalizeRisk(report.brute_force_risk)}
                          </span>
                          <span className={`inline-flex w-fit items-center gap-1 rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${riskClasses(report.hardcoding_risk)}`}>
                            <Building2 size={13} />
                            HC {normalizeRisk(report.hardcoding_risk)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{report.weakest_section || "-"}</td>
                      <td className="max-w-xs px-4 py-4 leading-6 text-slate-700">{report.training_priority || "-"}</td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(report.created_at)}</td>
                    </tr>
                  );
                })}
                {filteredReports.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={8}>
                      No submitted assessment reports match the current filters.
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
