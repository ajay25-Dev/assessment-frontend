type RoleSource = {
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
} | null;

export function getAuthRole(user: RoleSource) {
  return String(
    user?.app_metadata?.role ||
      user?.user_metadata?.role ||
      "",
  )
    .trim()
    .toLowerCase();
}

export function normalizeRole(value: unknown) {
  return String(value || "").trim().toLowerCase();
}
