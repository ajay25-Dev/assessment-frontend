import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CircleAlert,
  Filter,
  GraduationCap,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { adminUi } from "@/lib/admin/ui";
import { requireAdmin } from "@/lib/admin/supabase-admin";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
  roll_number: string | null;
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
  student_roll_number: string;
  student_email: string;
  batch_name: string;
  college_name: string;
};

type ReadinessBucket = "Ready" | "Training Needed" | "Failed";
type RiskFilter = "All" | "Low" | "Medium" | "High";

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

function riskBadgeClasses(value: string | null | undefined) {
  const risk = normalizeRisk(value);
  if (risk === "High") return "border-red-200 bg-red-50 text-red-800";
  if (risk === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function combinedRisk(report: { brute_force_risk: string | null; hardcoding_risk: string | null }): RiskFilter {
  const bruteForce = normalizeRisk(report.brute_force_risk);
  const hardcoding = normalizeRisk(report.hardcoding_risk);
  if (bruteForce === "High" || hardcoding === "High") return "High";
  if (bruteForce === "Medium" || hardcoding === "Medium") return "Medium";
  return "Low";
}

function buildStudentReportHref(report: { student_id: string | null; attempt_id: string | null }) {
  if (report.student_id && report.attempt_id) {
    return `/admin/reports/students/${report.student_id}/attempts/${report.attempt_id}`;
  }
  if (report.student_id) return `/admin/reports/students/${report.student_id}`;
  return "/admin/reports/students";
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

  const queryFilter = asText(params.q).toLowerCase();
  const assessmentFilter = asText(params.assessment);
  const collegeFilter = asText(params.college);
  const batchFilter = asText(params.batch);
  const readinessFilter = asText(params.readiness);
  const riskFilterRaw = asText(params.risk);
  const riskFilter: RiskFilter =
    riskFilterRaw === "Low" || riskFilterRaw === "Medium" || riskFilterRaw === "High"
      ? riskFilterRaw
      : "All";
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
          "attempt_id",
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
    supabase.from("profiles").select("id,email,full_name,roll_number"),
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
      student_roll_number: profile?.roll_number || "-",
      student_email: profile?.email || report.student_id || "-",
      batch_name: batch?.name || "-",
      college_name: collegeName,
    } satisfies FilteredReport;
  });

  const filteredReports = enrichedReports.filter((report) => {
    const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
    const risk = combinedRisk(report);
    const createdAt = report.created_at ? new Date(report.created_at) : null;
    const fromDate = fromFilter ? new Date(`${fromFilter}T00:00:00`) : null;
    const toDate = toFilter ? new Date(`${toFilter}T23:59:59`) : null;
    const query = queryFilter.trim();

    if (query) {
      const haystack = `${report.student_name} ${report.student_roll_number} ${report.student_email} ${report.assessment_title || ""} ${report.batch_name} ${report.college_name}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (assessmentFilter && report.assessment_title !== assessmentFilter) return false;
    if (collegeFilter && report.college_name !== collegeFilter) return false;
    if (batchFilter && report.batch_name !== batchFilter) return false;
    if (readinessFilter && bucket !== readinessFilter) return false;
    if (riskFilter !== "All" && risk !== riskFilter) return false;
    if (fromDate && createdAt && createdAt < fromDate) return false;
    if (toDate && createdAt && createdAt > toDate) return false;
    return true;
  });

  const readinessCounts: Record<ReadinessBucket, number> = {
    Ready: 0,
    "Training Needed": 0,
    Failed: 0,
  };

  for (const report of filteredReports) {
    const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
    readinessCounts[bucket] += 1;
  }

  const assessmentOptions = [...new Set(enrichedReports.map((report) => report.assessment_title || "Untitled assessment"))].sort();
  const collegeOptions = [...new Set(enrichedReports.map((report) => report.college_name).filter((item) => item && item !== "-"))].sort();
  const batchOptions = [...new Set(enrichedReports.map((report) => report.batch_name).filter((item) => item && item !== "-"))].sort();

  const readyCount = filteredReports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Ready").length;
  const trainingNeededCount = filteredReports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Training Needed").length;
  const failedCount = filteredReports.filter((report) => normalizeBucket(report.readiness_bucket, report.readiness_label) === "Failed").length;
  const activeFilterCount = [
    queryFilter,
    assessmentFilter,
    collegeFilter,
    batchFilter,
    readinessFilter,
    riskFilter !== "All" ? riskFilter : "",
    fromFilter,
    toFilter,
  ].filter(Boolean).length;

  const statCards = [
    {
      label: "Total Reports",
      value: filteredReports.length,
      icon: BarChart3,
      tone: "border-slate-200 bg-white text-slate-950",
      detail: "All submissions currently in view.",
    },
    {
      label: "Training Needed",
      value: trainingNeededCount,
      icon: CircleAlert,
      tone: "border-amber-200 bg-amber-50 text-amber-950 ring-1 ring-amber-100",
      detail: "Students who need targeted support.",
    },
    {
      label: "Failed",
      value: failedCount,
      icon: AlertTriangle,
      tone: "border-red-200 bg-red-50 text-red-950 ring-1 ring-red-100",
      detail: "Students who failed the selected scope.",
    },
    {
      label: "Ready",
      value: readyCount,
      icon: BadgeCheck,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
      detail: "Students who are ready for the next level.",
    },
    {
      label: "Avg Marks",
      value: average(filteredReports, "marks_score"),
      icon: GraduationCap,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-950",
      detail: "Weighted result for the selected scope.",
    },
    {
      label: "Avg Problem Solving",
      value: average(filteredReports, "capability_score"),
      icon: BadgeCheck,
      tone: "border-teal-200 bg-teal-50 text-teal-950",
      detail: "Real problem-solving strength.",
    },
  ] as const;

  return (
    <div className="grid gap-6">
      <section className={adminUi.workspaceCard}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className={adminUi.eyebrow}>
              Teacher dashboard
            </p>
            <h2 className={`${adminUi.pageTitle} mt-2`}>
              Reports
            </h2>
            <p className={`mt-3 ${adminUi.subtleText} sm:text-base`}>
              Review student performance, identify risk, and open student profiles.
            </p>
          </div>
          <Link href="/admin/reports/students" className={adminUi.primaryButton}>
            Student Drill-Down
          </Link>
        </div>
      </section>

      <section className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.label}
              className={`h-full rounded-[20px] border p-5 shadow-[var(--shadow-card)] ${item.tone}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={adminUi.eyebrow}>{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p>
                  <p className={`mt-2 ${adminUi.mutedText}`}>{item.detail}</p>
                </div>
                <span className="rounded-[12px] border border-white/70 bg-white/70 p-2.5 text-slate-800 shadow-sm">
                  <Icon size={18} />
                </span>
              </div>
            </article>
          );
        })}
      </section>

      <section className={adminUi.sectionCard}>
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className={adminUi.sectionTitle}>Search and filters</h3>
            <p className={`mt-1 ${adminUi.subtleText}`}>Search students, narrow the list, and keep the report view focused.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--status-ready-border)] bg-[var(--status-ready-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--status-ready-text)]">
            <Filter size={14} />
            {activeFilterCount} active filters
          </span>
        </div>

        <form className="mt-4 grid gap-3 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Filter size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={queryFilter}
              placeholder="Search student name, roll number, or email"
              className="w-full rounded-[12px] border border-[var(--color-border-strong)] bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)]"
            />
          </div>
          <select name="assessment" defaultValue={assessmentFilter} className="rounded-[12px] border border-[var(--color-border-strong)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)]">
            <option value="">All assessments</option>
            {assessmentOptions.map((assessment) => (
              <option key={assessment} value={assessment}>
                {assessment}
              </option>
            ))}
          </select>
          <select name="college" defaultValue={collegeFilter} className="rounded-[12px] border border-[var(--color-border-strong)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)]">
            <option value="">All colleges</option>
            {collegeOptions.map((college) => (
              <option key={college} value={college}>
                {college}
              </option>
            ))}
          </select>
          <select name="batch" defaultValue={batchFilter} className="rounded-[12px] border border-[var(--color-border-strong)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)]">
            <option value="">All batches</option>
            {batchOptions.map((batch) => (
              <option key={batch} value={batch}>
                {batch}
              </option>
            ))}
          </select>
          <select name="readiness" defaultValue={readinessFilter} className="rounded-[12px] border border-[var(--color-border-strong)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)]">
            <option value="">All readiness</option>
            <option value="Ready">Ready</option>
            <option value="Training Needed">Training Needed</option>
            <option value="Failed">Failed</option>
          </select>
          <select name="risk" defaultValue={riskFilter} className="rounded-[12px] border border-[var(--color-border-strong)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)]">
            <option value="All">All risk levels</option>
            <option value="Low">Low risk</option>
            <option value="Medium">Medium risk</option>
            <option value="High">High risk</option>
          </select>
          <input name="from" type="date" defaultValue={fromFilter} className="rounded-[12px] border border-[var(--color-border-strong)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)]" />
          <input name="to" type="date" defaultValue={toFilter} className="rounded-[12px] border border-[var(--color-border-strong)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--color-primary-300)] focus:ring-2 focus:ring-[var(--color-primary-100)]" />
          <div className="flex flex-wrap gap-2 xl:col-span-6">
            <button className={adminUi.primaryButton}>
              Apply Filters
            </button>
            <Link href="/admin/reports" className={adminUi.secondaryButton}>
              Clear
            </Link>
          </div>
        </form>
      </section>

      <section className={adminUi.sectionCard}>
        <div className="border-b border-[var(--color-border-subtle)] pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className={adminUi.sectionTitle}>Latest Submissions</h3>
              <p className={`mt-1 ${adminUi.subtleText}`}>Scan the latest assessments, risk signals, and next actions in one place.</p>
            </div>
            <CircleAlert className="text-[var(--color-text-muted)]" size={18} />
          </div>
        </div>

        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-[var(--color-bg-muted)] text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Assessment</th>
                  <th className="px-4 py-3 font-medium">Performance</th>
                  <th className="px-4 py-3 font-medium">Readiness / Risk</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {filteredReports.slice(0, 50).map((report, index) => {
                  const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
                  const risk = combinedRisk(report);
                  const profileHref = report.student_id ? `/admin/reports/students/${report.student_id}` : "/admin/reports/students";
                  const reportHref = buildStudentReportHref(report);

                  return (
                    <tr key={report.id} className="align-top transition hover:bg-[var(--color-bg-muted)]">
                      <td className="px-4 py-4 text-slate-500">{index + 1}</td>
                      <td className="px-4 py-4">
                        <Link href={profileHref} className="block rounded-[14px] p-2 -m-2 transition hover:bg-white">
                          <div className="space-y-1.5">
                            <p className="font-semibold text-slate-950">{report.student_name}</p>
                            <p className="text-xs text-slate-500">{report.student_roll_number}</p>
                            <p className="text-xs text-slate-500">{report.student_email}</p>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                              <span>{report.college_name}</span>
                              <span>{report.batch_name}</span>
                            </div>
                            <p className="text-xs font-semibold text-[var(--color-primary-800)]">Open Profile</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1.5">
                          <p className="font-semibold text-slate-950">{report.assessment_title || "Untitled assessment"}</p>
                          <p className="text-xs text-slate-500">Batch: {report.batch_name}</p>
                          <p className="text-xs text-slate-500">College: {report.college_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="grid gap-2 text-xs text-slate-600">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-[var(--color-border-subtle)] bg-white px-2.5 py-1 font-semibold text-slate-800">Marks {score(report.marks_score)}</span>
                            <span className="rounded-full border border-[var(--color-border-subtle)] bg-white px-2.5 py-1 font-semibold text-slate-800">Problem Solving {score(report.capability_score)}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1">DSA {score(report.dsa_score)}</span>
                            <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1">SQL {score(report.sql_score)}</span>
                            <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1">OOPs {score(report.oops_score)}</span>
                            <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] px-2.5 py-1">MCQ {score(report.mcq_score)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="grid gap-2">
                          <div className="flex flex-wrap gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${readinessClasses(bucket)}`}>{bucket}</span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskBadgeClasses(report.brute_force_risk)}`}>
                              <AlertTriangle size={13} />
                              BF {normalizeRisk(report.brute_force_risk)}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskBadgeClasses(report.hardcoding_risk)}`}>
                              <Building2 size={13} />
                              HC {normalizeRisk(report.hardcoding_risk)}
                            </span>
                          </div>
                          <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${risk === "High" ? "border-red-200 bg-red-50 text-red-800" : risk === "Medium" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                            Combined risk {risk}
                          </span>
                          <p className="text-sm leading-6 text-slate-700">{report.training_priority || "-"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formatDate(report.created_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link href={profileHref} className={adminUi.secondaryButton}>
                            Open Profile
                          </Link>
                          <Link href={reportHref} target="_blank" rel="noopener noreferrer" className={adminUi.ghostButton}>
                            View Report
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredReports.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                      No submitted assessment reports match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:hidden">
          {filteredReports.slice(0, 50).map((report, index) => {
            const bucket = normalizeBucket(report.readiness_bucket, report.readiness_label);
            const risk = combinedRisk(report);
            const profileHref = report.student_id ? `/admin/reports/students/${report.student_id}` : "/admin/reports/students";
            const reportHref = buildStudentReportHref(report);

            return (
              <article key={report.id} className="rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">#{index + 1}</p>
                    <Link href={profileHref} className="block rounded-[12px] p-2 -m-2 transition hover:bg-white">
                      <p className="truncate text-base font-semibold text-slate-950">{report.student_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{report.student_roll_number}</p>
                      <p className="mt-1 text-xs text-slate-500">{report.student_email}</p>
                      <p className="mt-1 text-xs text-slate-500">{report.batch_name} · {report.college_name}</p>
                      <p className="mt-2 text-xs font-semibold text-emerald-800">Student Profile</p>
                    </Link>
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${readinessClasses(bucket)}`}>
                    {bucket}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="rounded-[14px] border border-slate-200 bg-white px-3 py-3">
                    <p className="text-sm font-semibold text-slate-950">{report.assessment_title || "Untitled assessment"}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(report.created_at)}</p>
                  </div>

                  <div className="grid gap-2 rounded-[14px] border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-800">Marks {score(report.marks_score)}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-800">Problem Solving {score(report.capability_score)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">DSA {score(report.dsa_score)}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">SQL {score(report.sql_score)}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">OOPs {score(report.oops_score)}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">MCQ {score(report.mcq_score)}</span>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-[14px] border border-slate-200 bg-white px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${readinessClasses(bucket)}`}>{bucket}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskBadgeClasses(report.brute_force_risk)}`}>
                        <AlertTriangle size={13} />
                        BF {normalizeRisk(report.brute_force_risk)}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${riskBadgeClasses(report.hardcoding_risk)}`}>
                        <Building2 size={13} />
                        HC {normalizeRisk(report.hardcoding_risk)}
                      </span>
                    </div>
                    <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${risk === "High" ? "border-red-200 bg-red-50 text-red-800" : risk === "Medium" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                      Combined risk {risk}
                    </span>
                    <p className="text-sm leading-6 text-slate-700">{report.training_priority || "-"}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={profileHref} className="rounded-[12px] border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      Open Student Profile
                    </Link>
                    <Link href={reportHref} target="_blank" rel="noopener noreferrer" className="rounded-[12px] border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100">
                      View Report
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          {filteredReports.length === 0 ? (
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No submitted assessment reports match the current filters.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
