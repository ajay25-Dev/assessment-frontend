import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const response = new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Signing out...</title>
  <script>
    // Clear all JoraIQ assessment data from localStorage before redirecting
    (function() {
      var keysToRemove = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.startsWith("joraiq-assessment:") || key.startsWith("assessment-finalize:"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(function(k) { localStorage.removeItem(k); });
      // Also clear startedAt companion keys
      keysToRemove.forEach(function(k) { localStorage.removeItem(k + ":startedAt"); });
    })();
    window.location.href = "/login";
  </script>
</head>
<body>
  <p>Signing out...</p>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
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

    await supabase.auth.signOut().catch(() => undefined);
  }

  request.cookies.getAll().forEach((cookie) => {
    if (cookie.name.startsWith("sb-")) {
      response.cookies.delete(cookie.name);
    }
  });

  return response;
}