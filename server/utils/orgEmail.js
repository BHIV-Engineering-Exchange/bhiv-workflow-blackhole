/**
 * Org email policy (all branches): address must include both "bhiv" and "blackhole" (case-insensitive).
 * Example: bhiv.name@blackhole.com
 */

function isValidOrgEmail(email) {
  if (!email || typeof email !== "string") return false;
  const e = email.toLowerCase();
  return e.includes("bhiv") && e.includes("blackhole");
}

/** Clauses to combine in User.find / findOne: { ...filters, $and: orgEmailMongoClauses() } */
function orgEmailMongoClauses() {
  return [{ email: { $regex: /bhiv/i } }, { email: { $regex: /blackhole/i } }];
}

const ORG_EMAIL_ERROR =
  "Email must include both 'bhiv' and 'blackhole' (e.g. bhiv.name@blackhole.com)";

module.exports = { isValidOrgEmail, orgEmailMongoClauses, ORG_EMAIL_ERROR };
