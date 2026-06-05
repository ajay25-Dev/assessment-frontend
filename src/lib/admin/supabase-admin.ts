import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseService } from "@/lib/supabase-service";
import { getAuthRole, normalizeRole } from "@/lib/user-role";

type SupabaseQueryResult = {
  data?: unknown;
  error?: { message: string } | null;
  count?: number | null;
};

type SupabaseQuery = PromiseLike<SupabaseQueryResult> & {
  select(...args: unknown[]): SupabaseQuery;
  eq(...args: unknown[]): SupabaseQuery;
  order(...args: unknown[]): SupabaseQuery;
    limit(...args: unknown[]): SupabaseQuery;
    insert(...args: unknown[]): SupabaseQuery;
    update(...args: unknown[]): SupabaseQuery;
    delete(): SupabaseQuery;
    single(): Promise<SupabaseQueryResult>;
    maybeSingle(): Promise<SupabaseQueryResult>;
  };

export type SupabaseAdminClient = Omit<Awaited<ReturnType<typeof supabaseServer>>, "from"> & {
  from(table: string): SupabaseQuery;
};

type AdminProfile = {
  id?: string | null;
  email?: string | null;
  full_name?: string | null;
  role?: string | null;
};

export async function requireAdmin() {
  const userSupabase = await supabaseServer();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) redirect("/login?next=/admin");

  const serviceSupabase = supabaseService() as unknown as SupabaseAdminClient;
  const { data: profileData } = await serviceSupabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileData as AdminProfile | null;

  if (getAuthRole(user) !== "admin" && normalizeRole(profile?.role) !== "admin") {
    redirect("/dashboard");
  }

  return { supabase: serviceSupabase, user, profile };
}

export function cleanString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

export function cleanNumber(value: FormDataEntryValue | null) {
  if (value === null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
