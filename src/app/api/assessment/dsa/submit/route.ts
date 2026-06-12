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

  const accessToken = typeof body.access_token === "string" && body.access_token.trim() ? body.access_token : null;
  const {
    data: { user },
  } = accessToken ? await supabase.auth.getUser(accessToken) : await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const submissionBody = { ...(body as Record<string, unknown>) };
  delete submissionBody.access_token;

  const response = await fetch(`${backendBaseUrl()}/assessment/dsa/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...submissionBody,
      student_id: user.id,
      student_email: user.email,
    }),
    cache: "no-store",
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Backend is unreachable";
    return NextResponse.json(
      { message: `Assessment backend is unreachable: ${message}` },
      { status: 502 },
    );
  });

  if (response instanceof NextResponse) return response;

  const payload = await response.json().catch(() => ({
    message: `DSA persistence failed with status ${response.status}`,
  }));

  return NextResponse.json(payload, { status: response.status });
}
