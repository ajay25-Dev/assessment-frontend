import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  FileQuestion,
  Gauge,
  Lock,
  Server,
} from "lucide-react";
import { redirect } from "next/navigation";
import { AssessmentEntryGate } from "./assessment-entry-gate";
import { AuthenticatedHeader } from "@/components/authenticated-header";
import { supabaseService } from "@/lib/supabase-service";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "DSA Coding",
    duration: "90 minutes",
    icon: Code2,
  },
  {
    title: "SQL",
    duration: "30 minutes",
    icon: Database,
  },
  {
    title: "OOPs",
    duration: "30 minutes",
    icon: Server,
  },
  {
    title: "Core CS MCQs",
    duration: "30 minutes",
    icon: FileQuestion,
  },
];

const dsaRules = [
  "All 4 DSA questions are mandatory.",
  "Each DSA question includes visible test cases and evaluation feedback.",
  "Strict execution time and memory limits apply.",
  "Run and submission activity is tracked.",
  "Code versions, submissions, and time taken per problem are tracked.",
];

const sqlItems = [
  "3 scenario-based SQL questions from Amazon, Commvault, and Autodesk contexts.",
  "Interactive PostgreSQL sandbox for running read-only queries.",
  "Final SQL evaluation checks joins, CTEs, windows, NULLs, duplicates, and business rules.",
];

const oopsItems = [
  "3 scenario-based OOPs design questions.",
  "Use the code editor to model classes, interfaces, and extensible designs.",
  "Evaluation focuses on abstraction, encapsulation, polymorphism, SOLID, and error handling.",
];

type PageProps = {
  searchParams?: Promise<{ assessmentId?: string }> | { assessmentId?: string };
};

type AssessmentAttemptRow = {
  id: string;
  created_at: string | null;
  status: string | null;
  client_metadata: {
    source_assessment_id?: string;
    integrity_status?: string;
    submission_mode?: string;
  } | null;
};

export default async function AssessmentStartPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const assessmentId = resolvedSearchParams.assessmentId;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = assessmentId ? `/assessment/start?assessmentId=${assessmentId}` : "/assessment/start";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const serviceSupabase = supabaseService();
  const { data: attemptData, error: attemptError } = await serviceSupabase
    .from("student_assessment_attempts")
    .select("id,created_at,status,client_metadata")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (attemptError) {
    throw new Error(`Could not load assessment attempt status: ${attemptError.message}`);
  }

  const assessmentAttemptRows = (attemptData || []) as AssessmentAttemptRow[];
  const finalStatuses = new Set(["submitted", "auto_submitted", "disqualified"]);
  const isFinalAttempt = (row: AssessmentAttemptRow) =>
    finalStatuses.has(row.status || "") || row.client_metadata?.integrity_status === "disqualified";
  const terminalAttempt =
    assessmentAttemptRows.find((row) => {
      if (!isFinalAttempt(row)) return false;
      return assessmentId ? row.client_metadata?.source_assessment_id === assessmentId : true;
    }) || null;

  const existingAttemptId = terminalAttempt?.id || null;
  if (existingAttemptId) {
    redirect(`/assessment/report?attemptId=${encodeURIComponent(existingAttemptId)}`);
  }

  const isDisqualified =
    terminalAttempt?.status === "disqualified" ||
    terminalAttempt?.client_metadata?.integrity_status === "disqualified";
  const hasCompletedAssessment = Boolean(existingAttemptId);
  const primaryCtaHref = assessmentId
    ? `/assessment/test?assessmentId=${assessmentId}`
    : "/assessment/test";
  const lockedActionHref = existingAttemptId
    ? `/assessment/report?attemptId=${encodeURIComponent(existingAttemptId)}`
    : "/dashboard";
  const lockedActionLabel = existingAttemptId ? "View Report" : "Go to Dashboard";

  return (
    <main className="min-h-dvh bg-[#f6f8f4]">
      <AuthenticatedHeader
        eyebrow="Jora Assessment"
        title="Assessment Welcome"
        subtitle="Review the assessment structure, timings, and rules before entering the workspace."
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="bg-[linear-gradient(135deg,#102f27_0%,#0f766e_58%,#e0b84d_180%)] p-6 text-white sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-[8px] bg-white/12 px-3 py-2 text-sm font-medium">
                <Clock size={16} />
                Test Duration: 3 Hours
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                {hasCompletedAssessment
                  ? isDisqualified
                    ? "Your assessment was disqualified."
                    : "Your assessment is completed."
                  : "Welcome to your JoraIQ college assessment."}
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-emerald-50">
                {hasCompletedAssessment
                  ? "This assessment cannot be retaken. Use the completed report screen to review the attempt."
                  : "Review the structure once, then continue into the 3-hour workspace for DSA, SQL, OOPs, and Core CS MCQs."}
              </p>
            </div>
            <div className="p-6 sm:p-8">
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle size={18} />
                  Attempt discipline
                </div>
                <p className="mt-3 text-sm leading-6 text-amber-900">
                  Compilation attempts are restricted. Repeated trial-and-error submissions may increase
                  brute-force risk and lower the final recommendation.
                </p>
              </div>
              <div className="mt-4">
                <AssessmentEntryGate
                  assessmentHref={primaryCtaHref}
                  locked={hasCompletedAssessment}
                  lockedLabel={isDisqualified ? "Disqualified" : "Completed"}
                  lockedDescription={
                    isDisqualified
                      ? "This assessment ended because an integrity violation was detected. The attempt cannot be reopened."
                      : "This assessment has already been submitted. The attempt cannot be reopened."
                  }
                  lockedActionHref={lockedActionHref}
                  lockedActionLabel={lockedActionLabel}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-4">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <article key={section.title} className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-800">
                  <Icon size={19} />
                </div>
                <h3 className="mt-4 font-semibold text-slate-950">{section.title}</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="font-medium text-slate-500">Duration</dt>
                    <dd className="mt-1 text-slate-900">{section.duration}</dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <Gauge size={18} />
              <h3 className="font-semibold">DSA Test Design</h3>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["4 Mandatory Problems", "Graphs, shortest paths, hashing, versioning, sliding window"],
                ["Open Tests", "Visible confidence and validation coverage"],
                ["Compiler Tracking", "Runs, submissions, timing, and output quality"],
              ].map(([title, purpose]) => (
                <div key={title} className="rounded-[8px] bg-slate-50 p-4">
                  <p className="font-medium text-slate-950">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{purpose}</p>
                </div>
              ))}
            </div>
            <ul className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              {dsaRules.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={16} />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <Database size={18} />
              <h3 className="font-semibold">SQL Test Design</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              SQL questions are business-scenario driven. They test reasoning, not syntax memorization.
            </p>
            <ul className="mt-5 space-y-3 text-sm text-slate-700">
              {sqlItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              Example level: identify customers whose purchase frequency dropped in the last 30 days
              compared to the previous 30 days, then calculate drop percentage.
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <Server size={18} />
              <h3 className="font-semibold">OOPs Test Design</h3>
            </div>
            <ul className="mt-5 space-y-3 text-sm text-slate-700">
              {oopsItems.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-700" size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[8px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-950">
              <Lock size={18} />
              <h3 className="font-semibold">Important Rules</h3>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
              <div className="rounded-[8px] bg-slate-50 p-4">Do not refresh or close the browser during the test.</div>
              <div className="rounded-[8px] bg-slate-50 p-4">Your screen is recorded during the assessment.</div>
              <div className="rounded-[8px] bg-slate-50 p-4">All submissions, compile attempts, and time taken are tracked.</div>
              <div className="rounded-[8px] bg-slate-50 p-4">Hidden test cases are used to catch hardcoded solutions.</div>
              <div className="rounded-[8px] bg-slate-50 p-4">Scenario-based MCQs require practical judgment, not direct theory recall.</div>
              <div className="rounded-[8px] bg-slate-50 p-4">The first tab or camera violation warns you; the next one disqualifies the attempt.</div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
