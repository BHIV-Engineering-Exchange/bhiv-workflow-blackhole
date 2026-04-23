const ALLOWED_DOMAINS = new Set(["gmail.com", "outlook.com"]);

/** Matches server: @gmail.com or @outlook.com; local part must contain bhiv or blackhole. */
export function isValidOrgEmail(email) {
  if (!email || typeof email !== "string") return false;
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return false;
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (!ALLOWED_DOMAINS.has(domain)) return false;
  return local.includes("bhiv") || local.includes("blackhole");
}
