/** Matches server policy: email must include both "bhiv" and "blackhole" (case-insensitive). */
export function isValidOrgEmail(email) {
  if (!email || typeof email !== "string") return false;
  const e = email.toLowerCase();
  return e.includes("bhiv") && e.includes("blackhole");
}
