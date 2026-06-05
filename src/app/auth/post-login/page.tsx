import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { getSafeNextPath } from "@/lib/auth-paths";
import { getAuthRole, normalizeRole } from "@/lib/user-role";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function pickParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function PostLoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const params = ((await searchParams) || {}) as SearchParams;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (getAuthRole(user) === "admin" || normalizeRole(profile?.role) === "admin") {
    redirect("/admin");
  }

  redirect(getSafeNextPath(pickParam(params, "next"), "/assessment/start"));
}
