import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ hasAttempt: false }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const assessmentId = body?.assessment_id as string | undefined;

  if (!assessmentId) {
    return NextResponse.json({ hasAttempt: false }, { status: 400 });
  }

  const finalStatuses = ["submitted", "auto_submitted", "disqualified"];

  const { data: attemptData, error: attemptError } = await supabase
    .from("student_assessment_attempts")
    .select("id,status,client_metadata")
    .eq("student_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (attemptError) {
    return NextResponse.json({ hasAttempt: false, error: attemptError.message }, { status: 500 });
  }

  const rows = (attemptData || []) as Array<{
    id: string;
    status: string | null;
    client_metadata: { source_assessment_id?: string } | null;
  }>;

  const matchingAttempt = rows.find((row) =>
    row.client_metadata?.source_assessment_id === assessmentId &&
    finalStatuses.includes(row.status || "")
  ) || null;

  const attemptId = matchingAttempt?.id || null;

  if (attemptId) {
    return NextResponse.json({ hasAttempt: true, attemptId });
  }

  return NextResponse.json({ hasAttempt: false });
}
