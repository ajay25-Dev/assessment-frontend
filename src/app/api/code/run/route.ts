import { NextRequest, NextResponse } from "next/server";

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

async function forwardCodeRequest(request: NextRequest, action: "run" | "submit") {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const response = await fetch(`${backendBaseUrl()}/code/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({
    message: `Compiler request failed with status ${response.status}`,
  }));

  return NextResponse.json(payload, { status: response.status });
}

export async function POST(request: NextRequest) {
  return forwardCodeRequest(request, "run");
}
