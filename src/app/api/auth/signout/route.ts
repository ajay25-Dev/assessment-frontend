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
    // Preserve active assessment state so a login can resume the timer.
    (function() {
      var keysToTouch = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.startsWith("joraiq-assessment:") && !key.endsWith(":logoutCount")) {
          keysToTouch.push(key);
        }
      }
      keysToTouch.forEach(function(k) {
        var logoutCountKey = k + ":logoutCount";
        var currentCount = Number(localStorage.getItem(logoutCountKey) || "0");
        localStorage.setItem(logoutCountKey, String(currentCount + 1));
      });
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
