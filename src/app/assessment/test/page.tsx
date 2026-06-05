import { redirect } from "next/navigation";
import Link from "next/link";
import { AssessmentShell } from "@/components/assessment/assessment-shell";
import { fetchAssessmentBank } from "@/lib/assessment-bank-api";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ assessmentId?: string }> | { assessmentId?: string };
};

export default async function AssessmentTestPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const assessmentId = resolvedSearchParams.assessmentId;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = assessmentId ? `/assessment/test?assessmentId=${assessmentId}` : "/assessment/test";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const assessmentBank = await fetchAssessmentBank().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Question bank could not be loaded.";
    return { error: message };
  });

  if ("error" in assessmentBank) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f6f8f4] px-4">
        <section className="max-w-lg rounded-[8px] border border-amber-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-800">Assessment unavailable</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Could not load the question bank</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{assessmentBank.error}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/dashboard" className="rounded-[8px] border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
              Back to Dashboard
            </Link>
            <Link href={assessmentId ? `/assessment/test?assessmentId=${assessmentId}` : "/assessment/test"} className="rounded-[8px] bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
              Retry
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <AssessmentShell assessmentBank={assessmentBank} assessmentInstanceId={assessmentId} />;
}
