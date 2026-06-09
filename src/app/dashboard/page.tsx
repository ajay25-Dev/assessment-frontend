import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Code2,
  Database,
  Gauge,
  GraduationCap,
  LogOut,
  ShieldAlert,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseService } from "@/lib/supabase-service";
import { supabaseServer } from "@/lib/supabase-server";
import { getAuthRole, normalizeRole } from "@/lib/user-role";

export const dynamic = "force-dynamic";

const subjectTypeLabels: Record<string, string> = {
  coding_with_data: "Coding with data",
  coding_without_data: "Coding without data",
  text: "Text",
  subjective: "Subjective",
};

type ScoreTone = "green" | "amber" | "red" | "blue";
type RiskLevel = "Low" | "Medium" | "High";
type CompilationBehaviour = "Clean" | "Warnings" | "Failed";
type ReadinessLabel =
  | "Elite 1% Company Ready"
  | "Strong Company Ready"
  | "Near Ready"
  | "Trainable but Not Ready"
  | "Risky High Scorer"
  | "Not Ready";

type StudentAssessmentReportRow = {
  id: string;
  student_id: string;
  assessment_id: string | null;
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
  strongest_section: string | null;
  weakest_section: string | null;
  training_recommendation: string | null;
  faculty_insight: string | null;
  company_recommendation: string | null;
  student_summary: string | null;
  detailed_strengths: unknown;
  detailed_weaknesses: unknown;
  next_3_learning_actions: unknown;
  created_at: string | null;
};

type AvailableAssessment = {
  id: string;
  title: string | null;
  description: string | null;
  duration_minutes: number | null;
  status: string | null;
  subjects: string[];
};

type AssessmentReportRow = {
  assessment_id: string | null;
  attempt_id: string | null;
  report_json: { integrity?: { status?: string } } | null;
  created_at: string | null;
};

type AssessmentAttemptRow = {
  id: string;
  created_at: string | null;
  client_metadata: {
    source_assessment_id?: string;
    integrity_status?: string;
    submission_mode?: string;
  } | null;
};

type AvailableAssessmentCard = AvailableAssessment & {
  attemptId: string | null;
  cardLabel: string;
  ctaLabel: string;
  ctaHref: string;
  cardTone: "available" | "completed" | "disqualified";
};

function clampScore(value: number | null | undefined) {
  const score = Number(value || 0);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

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

function normalizeRisk(value: string | null | undefined): RiskLevel {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "high") return "High";
  if (normalized === "medium") return "Medium";
  return "Low";
}

function normalizeCompilation(value: string | null | undefined): CompilationBehaviour {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "failed") return "Failed";
  if (normalized === "warnings") return "Warnings";
  return "Clean";
}

function normalizeReadiness(value: string | null | undefined): ReadinessLabel {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ready") return "Strong Company Ready";
  if (normalized === "training needed") return "Trainable but Not Ready";
  if (normalized === "failed") return "Not Ready";
  if (normalized === "needs practice") return "Trainable but Not Ready";
  if (normalized === "at risk") return "Not Ready";
  if (normalized === "elite 1% company ready") return "Elite 1% Company Ready";
  if (normalized === "strong company ready") return "Strong Company Ready";
  if (normalized === "near ready") return "Near Ready";
  if (normalized === "risky high scorer") return "Risky High Scorer";
  if (normalized === "not ready") return "Not Ready";
  return "Trainable but Not Ready";
}

function toneForScore(score: number): ScoreTone {
  if (score >= 80) return "green";
  if (score >= 70) return "blue";
  if (score >= 55) return "amber";
  return "red";
}

function toneClasses(tone: ScoreTone) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return tones[tone];
}

function riskTone(value: RiskLevel) {
  if (value === "Low") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "Medium") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function compilationTone(value: CompilationBehaviour) {
  if (value === "Clean") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "Warnings") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function readinessTone(value: ReadinessLabel) {
  if (value === "Elite 1% Company Ready" || value === "Strong Company Ready") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (value === "Near Ready" || value === "Trainable but Not Ready") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-800";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function ScoreCard({
  label,
  value,
  note,
  icon: Icon,
}: {
  label: string;
  value: number;
  note: string;
  icon: typeof Target;
}) {
  const tone = toneForScore(value);

  return (
    <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
        </div>
        <span className={`rounded-[8px] border p-2 ${toneClasses(tone)}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-emerald-700"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{note}</p>
    </article>
  );
}

function AvailableAssessments({ assessments }: { assessments: AvailableAssessmentCard[] }) {
  if (assessments.length === 0) {
    return (
      <article className="rounded-[8px] border border-amber-200 bg-amber-50 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-800">
          No Test Assigned
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">No assessment assigned to your batch yet</h2>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Ask the admin to assign a published assessment to your batch.
        </p>
      </article>
    );
  }

  return (
    <div className="grid gap-4">
      {assessments.map((assessment) => (
        <article
          key={assessment.id}
          className={`rounded-[8px] p-5 ${
            assessment.cardTone === "available"
              ? "border border-emerald-200 bg-emerald-50"
              : assessment.cardTone === "completed"
                ? "border border-sky-200 bg-sky-50"
                : "border border-red-200 bg-red-50"
          }`}
        >
          <p
            className={`text-sm font-semibold uppercase tracking-[0.16em] ${
              assessment.cardTone === "available"
                ? "text-emerald-800"
                : assessment.cardTone === "completed"
                  ? "text-sky-800"
                  : "text-red-800"
            }`}
          >
            {assessment.cardLabel}
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">
            {assessment.title || "Placement Readiness Assessment"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {assessment.description ||
              "Complete hard-level DSA, very hard scenario-based SQL, OOPs, and Core CS MCQs to unlock your report."}
          </p>
          {assessment.subjects.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {assessment.subjects.map((subject) => (
                <span key={subject} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                  {subject}
                </span>
              ))}
            </div>
          ) : null}
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-[8px] bg-white p-3">
              <dt className="font-medium text-slate-500">Duration</dt>
              <dd className="mt-1 font-semibold text-slate-950">{assessment.duration_minutes || 180} min</dd>
            </div>
            <div className="rounded-[8px] bg-white p-3">
              <dt className="font-medium text-slate-500">Sections</dt>
              <dd className="mt-1 font-semibold text-slate-950">4 Parts</dd>
            </div>
            <div className="rounded-[8px] bg-white p-3">
              <dt className="font-medium text-slate-500">Level</dt>
              <dd className="mt-1 font-semibold text-slate-950">Hard</dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {["DSA: 90 min", "SQL: 30 min", "OOPs: 30 min", "Core CS: 30 min"].map((item) => (
              <div key={item} className="rounded-[8px] bg-white/75 px-3 py-2 font-medium text-slate-800">
                {item}
              </div>
            ))}
          </div>
          <Link
            href={assessment.ctaHref}
            className={`mt-5 inline-flex h-11 items-center justify-center rounded-[8px] px-5 text-sm font-semibold text-white ${
              assessment.cardTone === "available"
                ? "bg-emerald-700 hover:bg-emerald-800"
                : assessment.cardTone === "completed"
                  ? "bg-sky-700 hover:bg-sky-800"
                  : "bg-red-700 hover:bg-red-800"
            }`}
          >
            {assessment.ctaLabel}
          </Link>
        </article>
      ))}
    </div>
  );
}

function DashboardTopBar() {
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Jora Assessment
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-950">Student Dashboard</h1>
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (getAuthRole(user) === "admin" || normalizeRole(profile?.role) === "admin") {
    redirect("/admin");
  }

  const serviceSupabase = supabaseService();
  const { data: studentBatchRows, error: studentBatchError } = await serviceSupabase
    .from("batch_students")
    .select("batch_id")
    .eq("student_id", user.id);

  if (studentBatchError) {
    throw new Error(`Could not load student batch assignments: ${studentBatchError.message}`);
  }

  const studentBatchIds = Array.from(
    new Set((studentBatchRows || []).map((row) => row.batch_id).filter(Boolean)),
  );
  let availableAssessmentCards: AvailableAssessmentCard[] = [];

  if (studentBatchIds.length > 0) {
    const { data: assessmentBatchRows, error: assessmentBatchError } = await serviceSupabase
      .from("assessment_batches")
      .select("assessment_id")
      .in("batch_id", studentBatchIds);

    if (assessmentBatchError) {
      throw new Error(`Could not load batch assessments: ${assessmentBatchError.message}`);
    }

    const assessmentIds = Array.from(
      new Set((assessmentBatchRows || []).map((row) => row.assessment_id).filter(Boolean)),
    );

    if (assessmentIds.length > 0) {
      const { data: availableAssessmentRows, error: availableAssessmentError } = await serviceSupabase
        .from("assessments")
        .select("id,title,description,duration_minutes,status")
        .eq("status", "published")
        .in("id", assessmentIds)
        .order("created_at", { ascending: false });

      if (availableAssessmentError) {
        throw new Error(`Could not load available assessments: ${availableAssessmentError.message}`);
      }

      const { data: assessmentSubjectRows, error: assessmentSubjectError } = await serviceSupabase
        .from("assessment_subjects")
        .select("assessment_id,subject_id")
        .in("assessment_id", assessmentIds);

      if (assessmentSubjectError) {
        throw new Error(`Could not load assessment subjects: ${assessmentSubjectError.message}`);
      }

      const subjectIds = Array.from(
        new Set((assessmentSubjectRows || []).map((row) => row.subject_id).filter(Boolean)),
      );
      const { data: subjectRows, error: subjectError } = subjectIds.length > 0
        ? await serviceSupabase.from("subjects").select("id,name,subject_type,duration_minutes").in("id", subjectIds)
        : { data: [], error: null };

      if (subjectError) {
        throw new Error(`Could not load subjects: ${subjectError.message}`);
      }

      const subjectById = new Map(
        (subjectRows || []).map((subject) => {
          const typeLabel = subject.subject_type ? subjectTypeLabels[subject.subject_type] : null;
          const durationLabel = subject.duration_minutes ? `${subject.duration_minutes} min` : null;
          const label = [subject.name, typeLabel, durationLabel].filter(Boolean).join(" - ");
          return [subject.id, label];
        }),
      );
      const subjectsByAssessmentId = (assessmentSubjectRows || []).reduce<Map<string, string[]>>((map, row) => {
        const subjectName = row.subject_id ? subjectById.get(row.subject_id) : null;
        if (!row.assessment_id || !subjectName) return map;
        const current = map.get(row.assessment_id) || [];
        current.push(subjectName);
        map.set(row.assessment_id, current);
        return map;
      }, new Map());

      const { data: assessmentAttemptRows, error: assessmentAttemptError } = await serviceSupabase
        .from("student_assessment_attempts")
        .select("id,created_at,client_metadata")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (assessmentAttemptError) {
        throw new Error(`Could not load assessment attempt states: ${assessmentAttemptError.message}`);
      }

      const latestAttemptByAssessmentId = (assessmentAttemptRows || []).reduce<Map<string, AssessmentAttemptRow>>(
        (map, row) => {
          const sourceAssessmentId = row.client_metadata?.source_assessment_id;
          if (!sourceAssessmentId || !assessmentIds.includes(sourceAssessmentId)) return map;
          if (!map.has(sourceAssessmentId)) {
            map.set(sourceAssessmentId, row as AssessmentAttemptRow);
          }
          return map;
        },
        new Map(),
      );

      availableAssessmentCards = (availableAssessmentRows || []).map((assessment) => {
        const assessmentWithSubjects: AvailableAssessment = {
          ...assessment,
          subjects: subjectsByAssessmentId.get(assessment.id) || [],
        };
        const latestAttempt = latestAttemptByAssessmentId.get(assessment.id) || null;
        const isDisqualified = latestAttempt?.client_metadata?.integrity_status === "disqualified";
        const hasCompletedAssessment = Boolean(latestAttempt?.id);

        return {
          ...assessmentWithSubjects,
          attemptId: latestAttempt?.id || null,
          cardLabel: !hasCompletedAssessment
            ? "Test Available"
            : isDisqualified
              ? "Assessment Disqualified"
              : "Test Completed",
          ctaLabel: !hasCompletedAssessment ? "Start Test" : isDisqualified ? "Disqualified" : "Completed",
          ctaHref:
            hasCompletedAssessment && latestAttempt?.id
              ? `/assessment/report?attemptId=${encodeURIComponent(latestAttempt.id)}`
              : `/assessment/start?assessmentId=${assessment.id}`,
          cardTone: !hasCompletedAssessment ? "available" : isDisqualified ? "disqualified" : "completed",
        };
      });
    }
  }

  const { data: reports, error } = await supabase
    .from("student_assessment_reports")
    .select(
      [
        "id",
        "student_id",
        "assessment_id",
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
        "strongest_section",
        "weakest_section",
        "training_recommendation",
        "faculty_insight",
        "company_recommendation",
        "student_summary",
        "detailed_strengths",
        "detailed_weaknesses",
        "next_3_learning_actions",
        "created_at",
      ].join(","),
    )
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Could not load student assessment reports: ${error.message}`);
  }

  const [latestReport, ...previousReports] = (reports || []) as unknown as StudentAssessmentReportRow[];

  if (!latestReport) redirect("/assessment/start");

  const marksScore = clampScore(latestReport.marks_score);
  const bruteForceRisk = normalizeRisk(latestReport.brute_force_risk);
  const hardcodingRisk = normalizeRisk(latestReport.hardcoding_risk);
  const compilationBehaviour = normalizeCompilation(latestReport.compilation_behaviour);
  const readinessLabel = normalizeReadiness(latestReport.readiness_label);
  const detailedStrengths = asStringArray(latestReport.detailed_strengths);
  const detailedWeaknesses = asStringArray(latestReport.detailed_weaknesses);
  const nextActions = asStringArray(latestReport.next_3_learning_actions);

  const scoreCards = [
    {
      label: "Marks Score",
      value: marksScore,
      icon: Target,
      note: "Weighted assessment result",
    },
    {
      label: "Capability Score",
      value: clampScore(latestReport.capability_score),
      icon: GraduationCap,
      note: "Concept and execution strength",
    },
    {
      label: "Approach Score",
      value: clampScore(latestReport.approach_score),
      icon: Gauge,
      note: "Planning and problem breakdown",
    },
    {
      label: "Complexity Score",
      value: clampScore(latestReport.complexity_score),
      icon: BarChart3,
      note: "Time and space efficiency",
    },
    {
      label: "Code Quality Score",
      value: clampScore(latestReport.code_quality_score),
      icon: Code2,
      note: "Readability, structure, naming",
    },
    {
      label: "Hidden Test Pass Rate",
      value: clampScore(latestReport.hidden_test_pass_rate),
      icon: ShieldAlert,
      note: "Unseen case reliability",
    },
  ];

  const sectionCards = [
    { label: "DSA Score", value: clampScore(latestReport.dsa_score), icon: Code2 },
    { label: "SQL Score", value: clampScore(latestReport.sql_score), icon: Database },
    { label: "OOPs Score", value: clampScore(latestReport.oops_score), icon: Wrench },
    { label: "MCQ Score", value: clampScore(latestReport.mcq_score), icon: BookOpen },
  ];

  return (
    <main className="min-h-dvh bg-[#f6f8f4]">
      <DashboardTopBar />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.4fr_0.8fr]">
            <div className="bg-[linear-gradient(135deg,#0f3d2e_0%,#126149_52%,#e2c45b_180%)] p-6 text-white sm:p-8">
              <p className="text-sm font-medium text-emerald-100">Welcome back, {user.email}</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
                Your latest coding assessment is ready for review.
              </h2>
              <div className="mt-6 flex flex-wrap gap-3 text-sm">
                <span className="rounded-[8px] bg-white/12 px-3 py-2">
                  {latestReport.assessment_title || "Untitled Assessment"}
                </span>
                <span className="rounded-[8px] bg-white/12 px-3 py-2">
                  Submitted {formatDate(latestReport.created_at)}
                </span>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <p className="text-sm font-medium text-slate-500">Readiness Label</p>
              <div className={`mt-3 inline-flex items-center gap-2 rounded-[8px] border px-3 py-2 text-sm font-semibold ${readinessTone(readinessLabel)}`}>
                <BadgeCheck size={18} />
                {readinessLabel}
              </div>
              <div className="mt-6">
                <p className="text-sm font-medium text-slate-500">Overall Marks</p>
                <p className="mt-2 text-5xl font-semibold text-slate-950">{marksScore}</p>
                <p className="mt-2 text-sm text-slate-600">Current client-facing performance score</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-950">Available Assessments</h3>
            <p className="mt-1 text-sm text-slate-600">Published tests assigned to your batch.</p>
          </div>
          <AvailableAssessments assessments={availableAssessmentCards} />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {scoreCards.map((score) => (
            <ScoreCard key={score.label} {...score} />
          ))}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {sectionCards.map(({ label, value, icon: Icon }) => (
            <article key={label} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-slate-950">
                <Icon size={18} />
                <h3 className="font-semibold">{label}</h3>
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-950">{value}</p>
            </article>
          ))}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <AlertTriangle size={18} />
              <h3 className="font-semibold">Brute-force Risk</h3>
            </div>
            <span className={`mt-5 inline-flex rounded-[8px] border px-3 py-2 text-sm font-semibold ${riskTone(bruteForceRisk)}`}>
              {bruteForceRisk}
            </span>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Tracks repeated trial-heavy submissions and weak optimization signals.
            </p>
          </article>

          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <Code2 size={18} />
              <h3 className="font-semibold">Hardcoding Risk</h3>
            </div>
            <span className={`mt-5 inline-flex rounded-[8px] border px-3 py-2 text-sm font-semibold ${riskTone(hardcodingRisk)}`}>
              {hardcodingRisk}
            </span>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Flags brittle output patterns, fixed answers, and non-generalized logic.
            </p>
          </article>

          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <CheckCircle2 size={18} />
              <h3 className="font-semibold">Compilation Behaviour</h3>
            </div>
            <span className={`mt-5 inline-flex rounded-[8px] border px-3 py-2 text-sm font-semibold ${compilationTone(compilationBehaviour)}`}>
              {compilationBehaviour}
            </span>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Measures whether the submitted solution compiles cleanly and consistently.
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Runtime Percentile</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{latestReport.runtime_percentile || "Unknown"}</p>
          </article>
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Strongest Area</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{latestReport.strongest_section || "-"}</p>
          </article>
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Weakest Area</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{latestReport.weakest_section || "-"}</p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <BookOpenCheck size={18} />
              <h3 className="font-semibold">Faculty Insight</h3>
            </div>
            <p className="mt-4 leading-7 text-slate-700">
              {latestReport.faculty_insight || "No faculty insight has been added yet."}
            </p>
          </article>

          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <Building2 size={18} />
              <h3 className="font-semibold">Company Recommendation</h3>
            </div>
            <p className="mt-4 leading-7 text-slate-700">
              {latestReport.company_recommendation || "No company recommendation has been added yet."}
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">Student Summary</h3>
            <p className="mt-4 leading-7 text-slate-700">{latestReport.student_summary || "No summary available."}</p>
          </article>
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-950">Training Recommendation</h3>
            <p className="mt-4 leading-7 text-slate-700">{latestReport.training_recommendation || "No training recommendation available."}</p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          {[
            { title: "Detailed Strengths", items: detailedStrengths },
            { title: "Detailed Weaknesses", items: detailedWeaknesses },
            { title: "Next 3 Learning Actions", items: nextActions },
          ].map((list) => (
            <article key={list.title} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-950">{list.title}</h3>
              {list.items.length ? (
                <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-700">
                  {list.items.map((item) => (
                    <li key={item} className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-600">No entries available.</p>
              )}
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-950">Recent Assessment History</h3>
              <p className="mt-1 text-sm text-slate-600">
                Loaded from <span className="font-mono">student_assessment_reports</span>.
              </p>
            </div>
            <TrendingUp className="text-emerald-700" size={20} />
          </div>
          <div className="mt-5 divide-y divide-slate-100">
            {[latestReport, ...previousReports].map((attempt) => (
              <div key={attempt.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div>
                  <p className="font-medium text-slate-950">
                    {attempt.assessment_title || "Untitled Assessment"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{formatDate(attempt.created_at)}</p>
                </div>
                <span className="text-sm font-semibold text-slate-950">
                  {clampScore(attempt.marks_score)}/100
                </span>
                <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                  {normalizeReadiness(attempt.readiness_label)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
