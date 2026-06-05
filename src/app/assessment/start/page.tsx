import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Code2,
  Database,
  FileQuestion,
  Gauge,
  Lock,
  Server,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "DSA Coding",
    duration: "90 minutes",
    focus: "Hard-level DSA",
    difficulty: "ServiceNow, Commvault, Amazon, Autodesk-type level",
    icon: Code2,
  },
  {
    title: "SQL",
    duration: "30 minutes",
    focus: "Scenario-based SQL queries",
    difficulty: "Very hard",
    icon: Database,
  },
  {
    title: "OOPs",
    duration: "30 minutes",
    focus: "Scenario-based OOPs questions",
    difficulty: "Medium to hard",
    icon: Server,
  },
  {
    title: "Core CS MCQs",
    duration: "30 minutes",
    focus: "CN, OS, Cloud, Security, Architecture, MS Office",
    difficulty: "Scenario-based",
    icon: FileQuestion,
  },
];

const dsaRules = [
  "Each DSA question includes 5 open test cases.",
  "Each DSA question includes 10-12 hidden test cases.",
  "Strict execution time and memory limits apply.",
  "Only 2-3 compilation attempts are allowed.",
  "Unlimited run or compile is not available.",
  "Code versions, submissions, and time taken per problem are tracked.",
];

const sqlItems = [
  "2 scenario-based SQL queries covering joins, grouping, filtering, and ranking.",
  "1 business case SQL problem to test practical analytics thinking.",
  "1 edge-case SQL problem involving NULLs, duplicates, or missing records.",
];

const oopsItems = [
  "8-10 scenario-based MCQs focused on best design or approach.",
  "3-5 code-output questions covering inheritance, polymorphism, and abstraction.",
  "1 design-based question for class design or system modelling.",
];

export default async function AssessmentStartPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/assessment/start");

  return (
    <main className="min-h-dvh bg-[#f6f8f4]">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Jora Assessment
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-950">Test Instructions</h1>
          </div>
          <Link
            href="/dashboard"
            className="rounded-[8px] border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="bg-[linear-gradient(135deg,#102f27_0%,#0f766e_58%,#e0b84d_180%)] p-6 text-white sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-[8px] bg-white/12 px-3 py-2 text-sm font-medium">
                <Clock size={16} />
                Test Duration: 3 Hours
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                Read the full structure before starting the assessment.
              </h2>
              <p className="mt-4 max-w-2xl leading-7 text-emerald-50">
                This test is designed for hard-level DSA, very hard scenario-based SQL, scenario-based
                OOPs, and scenario-based Core CS MCQs. Direct theory questions are avoided.
              </p>
            </div>
            <div className="p-6 sm:p-8">
              <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle size={18} />
                  Attempt Discipline
                </div>
                <p className="mt-3 text-sm leading-6 text-amber-900">
                  Compilation attempts are restricted. Repeated trial-and-error submissions may increase
                  brute-force risk and lower the final recommendation.
                </p>
              </div>
              <Link
                href="/assessment/test"
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Begin Assessment
                <ArrowRight size={18} />
              </Link>
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
                  <div>
                    <dt className="font-medium text-slate-500">Focus Area</dt>
                    <dd className="mt-1 text-slate-900">{section.focus}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-slate-500">Difficulty</dt>
                    <dd className="mt-1 text-slate-900">{section.difficulty}</dd>
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
                ["Hard DSA Problem 1", "Algorithmic thinking"],
                ["Hard DSA Problem 2", "Optimization and edge cases"],
                ["Debug/Optimize Code", "Interview-style reasoning"],
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
              <div className="rounded-[8px] bg-slate-50 p-4">All submissions, compile attempts, and time taken are tracked.</div>
              <div className="rounded-[8px] bg-slate-50 p-4">Hidden test cases are used to catch hardcoded solutions.</div>
              <div className="rounded-[8px] bg-slate-50 p-4">Scenario-based MCQs require practical judgment, not direct theory recall.</div>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
