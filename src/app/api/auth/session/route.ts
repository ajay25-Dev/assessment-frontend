import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Missing Supabase environment variables" }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const session = body && typeof body === "object" ? (body as { session?: unknown }).session : null;

  if (!session || typeof session !== "object") {
    return NextResponse.json({ error: "Missing session payload" }, { status: 400 });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.setSession(
    session as { access_token: string; refresh_token: string },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return response;
}
