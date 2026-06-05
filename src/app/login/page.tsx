import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Log in | Jora Assessment",
};

export default async function LoginPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/assessment/start");

  return (
    <main className="min-h-dvh bg-[linear-gradient(135deg,#f8fafc_0%,#ecfdf5_52%,#fefce8_100%)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="max-w-2xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Jora Assessment
          </p>
          <h2 className="text-4xl font-semibold leading-tight text-slate-950 md:text-5xl">
            Secure access for assessment workflows.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-700">
            Sign in to manage assessments, review progress, and continue where you left off.
          </p>
        </section>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
