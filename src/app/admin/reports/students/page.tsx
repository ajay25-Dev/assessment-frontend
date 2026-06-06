import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  Building2,
  Code2,
  Database,
  GraduationCap,
  Search,
  TrendingUp,
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
  readiness_label: string | null;
  readiness_bucket: string | null;
  strongest_section: string | null;
  weakest_section: string | null;
  training_priority: string | null;
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

type EnrichedReport = ReportRow & {
  student_name: string;
  student_email: string;
  batch_name: string;
  college_name: string;
};

type StudentAggregate = {
  student_id: string;
  student_name: string;
  student_email: string;
  batch_name: string;
  college_name: string;
  attempts_count: number;
  latest_assessment: string;
  latest_score: number;
  best_score: number;
  capability_score: number;
  latest_bucket: ReadinessBucket;
  strongest_section: string;
  weakest_section: string;
  high_bruteforce: boolean;
  high_hardcoding: boolean;
  last_submitted: string | null;
  training_priority: string;
};

function asText(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

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
  if (readiness.includes("risk") || readiness.includes("fail")) return "Failed";
  if (readiness.includes("need") || readiness.includes("practice")) return "Training Needed";
  return "Ready";
}

function readinessClasses(value: ReadinessBucket) {
  if (value === "Failed") return "border-red-200 bg-red-50 text-red-800";
  if (value === "Training Needed") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function riskClasses(isHigh: boolean) {
  return isHigh
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-slate-200 bg-slate-50 text-slate-600";
}

function sectionIcon(section: string) {
  if (section === "DSA") return Code2;
  if (section === "SQL") return Database;
  if (section === "OOPs") return Wrench;
  return BookOpen;
}

export default async function AdminReportStudentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();

  const queryFilter = asText(params.q).toLowerCase();
  const collegeFilter = asText(params.college);
  const batchFilter = asText(params.batch);
  const readinessFilter = asText(params.readiness);

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
          "readiness_label",
          "readiness_bucket",
          "strongest_section",
          "weakest_section",
          "training_priority",
          "created_at",
        ].join(","),
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("profiles").select("id,email,full_name"),
    supabase.from("batch_students").select("batch_id,student_id,created_at").order("created_at", { ascending: false }),
    supabase.from("batches").select("id,name,college_id").order("name"),
    supabase.from("colleges").select("id,name").order("name"),
  ]);

  if (reportError) {
    throw new Error(`Could not load student drill-down data: ${reportError.message}`);
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

  const enrichedReports: EnrichedReport[] = reports
    .filter((report) => Boolean(report.student_id))
    .map((report) => {
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
      };
    });

  const reportsByStudent = new Map<string, EnrichedReport[]>();
  for (const report of enrichedReports) {
    if (!report.student_id) continue;
    const current = reportsByStudent.get(report.student_id) || [];
    current.push(report);
    reportsByStudent.set(report.student_id, current);
  }

  const students: StudentAggregate[] = [...reportsByStudent.entries()].map(([studentId, studentReports]) => {
    const latest = studentReports[0];
    const bestScore = Math.max(...studentReports.map((report) => score(report.marks_score)));
    const highBruteforce = studentReports.some((report) => normalizeRisk(report.brute_force_risk) === "High");
    const highHardcoding = studentReports.some((report) => normalizeRisk(report.hardcoding_risk) === "High");

    return {
      student_id: studentId,
      student_name: latest.student_name,
      student_email: latest.student_email,
      batch_name: latest.batch_name,
      college_name: latest.college_name,
      attempts_count: studentReports.length,
      latest_assessment: latest.assessment_title || "Untitled assessment",
      latest_score: score(latest.marks_score),
      best_score: bestScore,
      capability_score: score(latest.capability_score),
      latest_bucket: normalizeBucket(latest.readiness_bucket, latest.readiness_label),
      strongest_section: latest.strongest_section || "-",
      weakest_section: latest.weakest_section || "-",
      high_bruteforce: highBruteforce,
      high_hardcoding: highHardcoding,
      last_submitted: latest.created_at,
      training_priority: latest.training_priority || "-",
    };
  });

  const filteredStudents = students.filter((student) => {
    if (queryFilter) {
      const haystack = `${student.student_name} ${student.student_email}`.toLowerCase();
      if (!haystack.includes(queryFilter)) return false;
    }
    if (collegeFilter && student.college_name !== collegeFilter) return false;
    if (batchFilter && student.batch_name !== batchFilter) return false;
    if (readinessFilter && student.latest_bucket !== readinessFilter) return false;
    return true;
  });

  filteredStudents.sort((left, right) => {
    const leftTime = left.last_submitted ? new Date(left.last_submitted).getTime() : 0;
    const rightTime = right.last_submitted ? new Date(right.last_submitted).getTime() : 0;
    return rightTime - leftTime;
  });

  const collegeOptions = [...new Set(students.map((student) => student.college_name).filter((item) => item && item !== "-"))].sort();
  const batchOptions = [...new Set(students.map((student) => student.batch_name).filter((item) => item && item !== "-"))].sort();

  const readyCount = filteredStudents.filter((student) => student.latest_bucket === "Ready").length;
  const trainingCount = filteredStudents.filter((student) => student.latest_bucket === "Training Needed").length;
  const failedCount = filteredStudents.filter((student) => student.latest_bucket === "Failed").length;
  const avgLatestScore = filteredStudents.length
    ? Math.round(filteredStudents.reduce((sum, student) => sum + student.latest_score, 0) / filteredStudents.length)
    : 0;

  return (
    <div className="grid gap-6">
      <section className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Student Drill-Down
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">Student assessment index</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">
              Group all submitted reports by student so admins can identify who is ready, who needs training, and whose risk signals need manual review.
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Reports
          </Link>
        </div>
      </section>

      <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-950">Filters</h3>
          <p className="mt-1 text-sm text-slate-600">Search the student population and isolate the readiness segment you want to review.</p>
        </div>
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              defaultValue={asText(params.q)}
              placeholder="Search name or email"
              className="w-full rounded-[8px] border border-slate-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
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
          <div className="flex gap-2">
            <button className="rounded-[8px] bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
              Apply
            </button>
            <a href="/admin/reports/students" className="rounded-[8px] border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Clear
            </a>
          </div>
        </form>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Students with Reports</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{filteredStudents.length}</p>
          <p className="mt-2 text-xs text-slate-500">Filtered student population</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Avg Latest Score</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{avgLatestScore}</p>
          <p className="mt-2 text-xs text-slate-500">Latest marks score across students</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ready vs Training</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{readyCount} / {trainingCount}</p>
          <p className="mt-2 text-xs text-slate-500">Ready students versus training-needed students</p>
        </article>
        <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Failed</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{failedCount}</p>
          <p className="mt-2 text-xs text-slate-500">Students currently blocked by low performance or high risk</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Batch</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Latest Assessment</th>
                <th className="px-4 py-3 font-medium">Scores</th>
                <th className="px-4 py-3 font-medium">Readiness</th>
                <th className="px-4 py-3 font-medium">Strong / Weak</th>
                <th className="px-4 py-3 font-medium">Risk Flags</th>
                <th className="px-4 py-3 font-medium">Training Priority</th>
                <th className="px-4 py-3 font-medium">Last Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => {
                const StrongIcon = sectionIcon(student.strongest_section);
                const WeakIcon = sectionIcon(student.weakest_section);

                return (
                  <tr key={student.student_id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-950">{student.student_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{student.student_email}</p>
                      <p className="mt-1 text-xs text-slate-500">{student.college_name}</p>
                      <Link
                        href={`/admin/reports/students/${student.student_id}`}
                        className="mt-3 inline-flex rounded-[8px] border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Open Profile
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{student.batch_name}</td>
                    <td className="px-4 py-4">
                      <div className="inline-flex rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-800">
                        {student.attempts_count}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{student.latest_assessment}</td>
                    <td className="px-4 py-4">
                      <div className="grid gap-1 text-xs text-slate-600">
                        <span className="font-semibold text-slate-950">Latest {student.latest_score}</span>
                        <span>Best {student.best_score}</span>
                        <span>Capability {student.capability_score}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${readinessClasses(student.latest_bucket)}`}>
                        {student.latest_bucket}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="grid gap-2">
                        <span className="inline-flex w-fit items-center gap-1 rounded-[8px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          <StrongIcon size={13} />
                          {student.strongest_section}
                        </span>
                        <span className="inline-flex w-fit items-center gap-1 rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          <WeakIcon size={13} />
                          {student.weakest_section}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="grid gap-2">
                        <span className={`inline-flex w-fit items-center gap-1 rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${riskClasses(student.high_bruteforce)}`}>
                          <AlertTriangle size={13} />
                          BF {student.high_bruteforce ? "High" : "Clear"}
                        </span>
                        <span className={`inline-flex w-fit items-center gap-1 rounded-[8px] border px-2.5 py-1 text-xs font-semibold ${riskClasses(student.high_hardcoding)}`}>
                          <Building2 size={13} />
                          HC {student.high_hardcoding ? "High" : "Clear"}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-xs px-4 py-4 leading-6 text-slate-700">{student.training_priority}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDate(student.last_submitted)}</td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={10}>
                    No students match the current drill-down filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-slate-950">
          <TrendingUp size={18} />
          <h3 className="font-semibold">Next Phase</h3>
        </div>
        <p className="mt-3 leading-7 text-slate-600">
          The next drill-down layer will open each student profile with attempt history, readiness progression, and direct links to individual assessment report cards.
        </p>
      </section>
    </div>
  );
}
