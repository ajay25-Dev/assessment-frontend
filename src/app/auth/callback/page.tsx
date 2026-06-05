"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSafeNextPath } from "@/lib/auth-paths";
import { supabaseBrowser } from "@/lib/supabase-browser";

function getHashSessionTokens() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) return null;

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

function AuthCallbackBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const run = async () => {
      const supabase = supabaseBrowser();
      const code = searchParams.get("code");
      const next = getSafeNextPath(searchParams.get("next"));
      const hashTokens = getHashSessionTokens();

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else if (hashTokens) {
        const { error } = await supabase.auth.setSession(hashTokens);
        if (error) throw error;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login?verified=1");
        return;
      }

      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });

      router.replace(next);
      router.refresh();
    };

    run().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Could not complete sign-in");
      router.replace("/login");
    });
  }, [router, searchParams]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <div className="inline-flex items-center gap-3 rounded-[8px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        <Loader2 className="animate-spin" size={18} />
        Finalizing sign-in...
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackBody />
    </Suspense>
  );
}

function AuthCallbackLoading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <div className="inline-flex items-center gap-3 rounded-[8px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700 shadow-sm">
        <Loader2 className="animate-spin" size={18} />
        Finalizing sign-in...
      </div>
    </main>
  );
}
