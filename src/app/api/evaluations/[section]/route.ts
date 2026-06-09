import { NextRequest, NextResponse } from "next/server";

const allowedSections = new Set(["dsa", "sql", "oops", "mcq", "dashboard"]);

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ section: string }> | { section: string } },
) {
  const { section } = await params;
  const normalizedSection = section.toLowerCase();

  if (!allowedSections.has(normalizedSection)) {
    return NextResponse.json({ message: "Unsupported evaluation section" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const response = await fetch(`${backendBaseUrl()}/evaluations/${normalizedSection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Backend is unreachable";
    return NextResponse.json(
      { message: `Evaluation backend is unreachable: ${message}` },
      { status: 502 },
    );
  });

  if (response instanceof NextResponse) return response;

  const payload = await response.json().catch(() => ({
    message: `AI evaluation failed with status ${response.status}`,
  }));

  return NextResponse.json(payload, { status: response.status });
}
