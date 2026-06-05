export function getSafeNextPath(candidate: string | null | undefined, fallback = "/dashboard") {
  const value = String(candidate || "").trim();
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.startsWith("/login") || value.startsWith("/signup")) return fallback;
  return value;
}
