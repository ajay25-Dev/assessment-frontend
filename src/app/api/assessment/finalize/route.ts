import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const response = await fetch(`${backendBaseUrl()}/assessment/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      student_id: user.id,
      student_email: user.email,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({
    message: `Assessment finalization failed with status ${response.status}`,
  }));

  return NextResponse.json(payload, { status: response.status });
}
