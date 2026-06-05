"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getSafeNextPath } from "@/lib/auth-paths";
import { supabaseBrowser } from "@/lib/supabase-browser";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const registered = searchParams.get("registered") === "1";
  const verified = searchParams.get("verified") === "1";

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginValues) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email.trim().toLowerCase(),
        password: values.password,
      });

      if (error) throw error;
      if (!data.session) throw new Error("Could not create a session");

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: data.session }),
      });

      if (!response.ok) throw new Error("Could not persist session");

      toast.success("Signed in successfully");
      router.replace(getSafeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setSubmitting(false);
    }
  };

  const loginWithGoogle = async () => {
    const origin = window.location.origin;
    const next = getSafeNextPath(searchParams.get("next"));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) toast.error(error.message);
  };

  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">Log in</h1>
        <p className="mt-2 text-sm text-slate-600">Access your Jora Assessment workspace.</p>
      </div>

      {registered ? (
        <div className="mb-4 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Account created. Check your email and verify it before logging in.
        </div>
      ) : null}

      {verified ? (
        <div className="mb-4 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Email verified. You can log in now.
        </div>
      ) : null}

      <button
        type="button"
        onClick={loginWithGoogle}
        className="mb-5 flex h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-slate-300 bg-white text-sm font-medium text-slate-800 transition hover:bg-slate-50"
      >
        Continue with Google
      </button>

      <div className="mb-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase text-slate-400">or</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            autoComplete="email"
            className="mt-2 h-11 w-full rounded-[8px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <span className="mt-1 block text-sm text-red-600">{form.formState.errors.email.message}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <span className="relative mt-2 block">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="h-11 w-full rounded-[8px] border border-slate-300 px-3 pr-11 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
              {...form.register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute inset-y-0 right-3 inline-flex items-center text-slate-500 hover:text-slate-800"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
          {form.formState.errors.password ? (
            <span className="mt-1 block text-sm text-red-600">{form.formState.errors.password.message}</span>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={submitting || form.formState.isSubmitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting || form.formState.isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
          Log in
          {!submitting && !form.formState.isSubmitting ? <ArrowRight size={18} /> : null}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Need an account?{" "}
        <Link className="font-semibold text-emerald-700 hover:text-emerald-800" href="/signup">
          Sign up
        </Link>
      </p>
    </div>
  );
}
