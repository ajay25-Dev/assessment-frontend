import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const response = await fetch(`${backendBaseUrl()}/assessment/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(body as Record<string, unknown>),
      student_id: user.id,
      student_email: user.email,
    }),
    cache: "no-store",
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Backend is unreachable";
    return NextResponse.json(
      { message: `Assessment session bootstrap failed: ${message}` },
      { status: 502 },
    );
  });

  if (response instanceof NextResponse) return response;

  const payload = await response.json().catch(() => ({
    message: `Assessment session bootstrap failed with status ${response.status}`,
  }));

  return NextResponse.json(payload, { status: response.status });
}
