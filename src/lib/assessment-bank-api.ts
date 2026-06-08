import type { AssessmentBank } from "@/data/assessment-bank";

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
