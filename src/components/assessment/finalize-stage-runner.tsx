"use client";

import { useEffect } from "react";

const stages = ["DSA", "SQL", "OOPs", "MCQ", "DASHBOARD"] as const;

export function FinalizeStageRunner({ attemptId }: { attemptId: string }) {
  useEffect(() => {
    let cancelled = false;

    async function processStages() {
      const storageKey = `assessment-finalize:${attemptId}`;
      const rawPayload = localStorage.getItem(storageKey);
      if (!rawPayload) return;

      try {
        const payload = JSON.parse(rawPayload) as Record<string, unknown>;

        for (const stage of stages) {
          if (cancelled) return;

          const response = await fetch(
            `/api/assessment/finalize/${encodeURIComponent(attemptId)}/${encodeURIComponent(stage)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          );

          if (!response.ok) {
            throw new Error(`Stage ${stage} failed with status ${response.status}`);
          }
        }

        localStorage.removeItem(storageKey);
      } catch {
        // Keep the saved payload so a later report-page visit can retry processing.
      }
    }

    void processStages();

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  return null;
}
