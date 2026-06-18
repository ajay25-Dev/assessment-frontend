import type { AssessmentBank } from "@/data/assessment-bank";
import type { AssessmentSecurityPolicy } from "@/data/assessment-bank";

export type AssessmentSessionState = {
  attempt_id: string;
  assessment_id: string;
  duration_minutes: number;
  remaining_seconds: number;
  security: AssessmentSecurityPolicy;
  started_at: string;
  status: string;
  timer_policy: "restart_on_login" | "resume_on_login";
  can_resume: boolean;
  session_reset_count: number;
};

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export async function fetchAssessmentBank(): Promise<AssessmentBank> {
  const response = await fetch(`${backendBaseUrl()}/question-bank`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Could not load question bank: ${response.status}`);
  }

  return (await response.json()) as AssessmentBank;
}

export async function bootstrapAssessmentSession(input: {
  assessment_id: string;
  student_email?: string;
  student_id: string;
}): Promise<AssessmentSessionState> {
  const response = await fetch(`/api/assessment/session`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Could not initialize assessment session: ${response.status}`);
  }

  return (await response.json()) as AssessmentSessionState;
}
