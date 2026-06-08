"use client";

import { useEffect, useState } from "react";

const stages = ["DSA", "SQL", "OOPs", "MCQ", "DASHBOARD"] as const;

type StageStatus = "idle" | "processing" | "done" | "failed";

export function FinalizeStageRunner({ attemptId }: { attemptId: string }) {
  const [status, setStatus] = useState<StageStatus>("idle");
  const [currentStage, setCurrentStage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function processStages() {
      const storageKey = `assessment-finalize:${attemptId}`;
      const rawPayload = localStorage.getItem(storageKey);
      if (!rawPayload) return;

      setStatus("processing");

      try {
        const payload = JSON.parse(rawPayload) as Record<string, unknown>;

        for (const stage of stages) {
          if (cancelled) return;
          setCurrentStage(stage);

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
        if (!cancelled) {
          setCurrentStage("");
          setStatus("done");
        }
      } catch {
        if (!cancelled) setStatus("failed");
      }
    }

    void processStages();

    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  if (status === "idle" || status === "done") return null;

  return (
    <div className="mt-4 rounded-[8px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {status === "processing"
        ? `Final report processing: ${currentStage || "starting"}`
        : "Final report background processing could not complete. Your submission is saved."}
    </div>
  );
}
