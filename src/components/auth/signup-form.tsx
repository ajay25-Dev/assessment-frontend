"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { supabaseBrowser } from "@/lib/supabase-browser";

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter the student's full name"),
    rollNumber: z.string().trim().min(1, "Enter the student's roll number"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Confirm your password"),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type SignupValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", rollNumber: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = async (values: SignupValues) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName.trim(),
          rollNumber: values.rollNumber.trim(),
          email: values.email.trim().toLowerCase(),
          password: values.password,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message || "Registration failed");
      }

      toast.success("Account created. Check your email to verify your account.");
      router.replace("/login?registered=1");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const signupWithGoogle = async () => {
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) toast.error(error.message);
  };

  return (
    <div className="rounded-[8px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">Create account</h1>
        <p className="mt-2 text-sm text-slate-600">Start using Jora Assessment.</p>
      </div>

      <button
        type="button"
        onClick={signupWithGoogle}
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
          <span className="text-sm font-medium text-slate-700">Full name</span>
          <input
            type="text"
            autoComplete="name"
            className="mt-2 h-11 w-full rounded-[8px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            {...form.register("fullName")}
          />
          {form.formState.errors.fullName ? (
            <span className="mt-1 block text-sm text-red-600">{form.formState.errors.fullName.message}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Roll number</span>
          <input
            type="text"
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-[8px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            {...form.register("rollNumber")}
          />
          {form.formState.errors.rollNumber ? (
            <span className="mt-1 block text-sm text-red-600">{form.formState.errors.rollNumber.message}</span>
          ) : null}
        </label>

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
          <input
            type="password"
            autoComplete="new-password"
            className="mt-2 h-11 w-full rounded-[8px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <span className="mt-1 block text-sm text-red-600">{form.formState.errors.password.message}</span>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            className="mt-2 h-11 w-full rounded-[8px] border border-slate-300 px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword ? (
            <span className="mt-1 block text-sm text-red-600">{form.formState.errors.confirmPassword.message}</span>
          ) : null}
        </label>

        <button
          type="submit"
          disabled={submitting || form.formState.isSubmitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting || form.formState.isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
          Create account
          {!submitting && !form.formState.isSubmitting ? <ArrowRight size={18} /> : null}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link className="font-semibold text-emerald-700 hover:text-emerald-800" href="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
