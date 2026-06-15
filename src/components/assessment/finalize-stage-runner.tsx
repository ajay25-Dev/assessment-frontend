"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

const stages = ["DSA", "SQL", "OOPs", "MCQ", "DASHBOARD"] as const;

export function FinalizeStageRunner({
  attemptId,
  fallbackPayload,
}: {
  attemptId: string;
  fallbackPayload?: Record<string, unknown> | null;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function processStages() {
      const storageKey = `assessment-finalize:${attemptId}`;
      const rawPayload = localStorage.getItem(storageKey);
      if (!rawPayload && !fallbackPayload) return;

      try {
        const supabase = supabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const payload = rawPayload
          ? (JSON.parse(rawPayload) as Record<string, unknown>)
          : fallbackPayload || {};

        for (const stage of stages) {
          if (cancelled) return;

          const response = await fetch(
            `/api/assessment/finalize/${encodeURIComponent(attemptId)}/${encodeURIComponent(stage)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...payload,
                access_token: session?.access_token || null,
              }),
            },
          );

          if (!response.ok) {
            throw new Error(`Stage ${stage} failed with status ${response.status}`);
          }
        }

        localStorage.removeItem(storageKey);
        router.refresh();
      } catch {
        // Keep the saved payload so a later report-page visit can retry processing.
      }
    }

    void processStages();

    return () => {
      cancelled = true;
    };
  }, [attemptId, fallbackPayload, router]);

  return null;
}
