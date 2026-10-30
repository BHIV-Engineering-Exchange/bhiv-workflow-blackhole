/**
 * Pravesh (blackhole_auth) read-only SSO bridge — Niyantran
 * =========================================================
 *
 * Pravesh is the BHIV shared authentication system (repo: blackhole_auth,
 * production origin https://pravesh.blackholeinfiverse.com). It issues an
 * httpOnly cookie named `blackhole_token`: an HS256 JWT signed with the
 * shared secret whose payload carries:
 *
 *   { user_id, email, tenant_id, roles[], permissions[], allowedApps[], isGuest }
 *
 * This module mirrors the reference integrations already live in Sampada
 * (`backend/services/gateway/pravesh_bridge.py`) and HackaVerse
 * (`hackathon/src/pravesh_bridge.py`) so all three products behave the same:
 *
 * * Verifies the cookie (or the `X-Pravesh-Token` header for API clients)
 *   locally with the shared secret — no calls back to Pravesh.
 * * Read-only by design: it never creates, merges or overwrites local
 *   accounts. The Pravesh identity is carried in its own namespace
 *   (`pravesh:<user_id>`).
 * * Email is a *linking attribute only* — we report whether a local account
 *   with the same email exists but never merge on email equality
 *   (BHIV vNEXT identity rule).
 * * If `PRAVESH_JWT_SECRET` is unset the bridge is inert and the existing
 *   x-auth-token login flow behaves exactly as before.
 *
 * Environment
 * -----------
 * PRAVESH_JWT_SECRET        Shared HS256 secret with blackhole_auth (empty = disabled)
 * PRAVESH_APP_SLUG          This app's slug in allowedApps (default: "niyantran")
 * PRAVESH_COOKIE_NAME       Cookie name (default: "blackhole_token")
 * PRAVESH_REQUIRE_APP_CLAIM "true" rejects tokens whose allowedApps omits the
 *                           app slug; "false" (default) lets any signed-in
 *                           Blackhole account open every product
 * PRAVESH_HEADER_NAME       Header carrying the token for API clients (default
 *                           "X-Pravesh-Token")
 */

"use strict";

const jwt = require("jsonwebtoken");

const DEFAULT_COOKIE_NAME = "blackhole_token";
const DEFAULT_APP_SLUG = "niyantran";
const DEFAULT_HEADER_NAME = "X-Pravesh-Token";
const IDENTITY_PREFIX = "pravesh:";

// Pravesh role claim -> Niyantran local role (never grants more than claimed)
const ROLE_MAP = { admin: "Admin", recruiter: "Manager", candidate: "User" };

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function praveshSecret() {
  return (process.env.PRAVESH_JWT_SECRET || "").trim();
}

function praveshEnabled() {
  return Boolean(praveshSecret());
}

function appSlug() {
  return (process.env.PRAVESH_APP_SLUG || DEFAULT_APP_SLUG).trim().toLowerCase();
}

function cookieName() {
  return (process.env.PRAVESH_COOKIE_NAME || DEFAULT_COOKIE_NAME).trim();
}

function headerName() {
  return (process.env.PRAVESH_HEADER_NAME || DEFAULT_HEADER_NAME).trim();
}

function requireAppClaim() {
  // Default off: one Blackhole sign-in grants every registered product, and
  // registering a new product must not require reissuing existing tokens.
  return (
    (process.env.PRAVESH_REQUIRE_APP_CLAIM || "false").trim().toLowerCase() ===
    "true"
  );
}

function bridgeStatus() {
  return {
    enabled: praveshEnabled(),
    app_slug: appSlug(),
    cookie_name: cookieName(),
    require_app_claim: requireAppClaim(),
    secret_configured: Boolean(praveshSecret()),
    mode: "read-only",
  };
}

// ---------------------------------------------------------------------------
// Token verification
// ---------------------------------------------------------------------------

function parseCookies(header) {
  const out = {};
  if (!header || typeof header !== "string") return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[key] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

function extractToken(req) {
  if (!req) return null;
  const cookies = parseCookies(req.headers && req.headers.cookie);
  const fromCookie = cookies[cookieName()];
  if (fromCookie) return fromCookie;
  const headers = (req.headers || {}) || {};
  const fromHeader =
    headers[headerName().toLowerCase()] || headers[headerName()];
  return fromHeader || null;
}

/**
 * Verify a Pravesh JWT (HS256) and return its payload, or null.
 * Rejects bad signatures, wrong algorithms, expiry and missing user_id.
 * Never throws.
 */
function verifyPraveshToken(token) {
  const secret = praveshSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (!payload || !payload.user_id) return null;
    return payload;
  } catch (err) {
    console.warn("[PRAVESH] Token rejected:", err.message);
    return null;
  }
}

function identityFromPayload(payload) {
  if (!payload) return null;
  const allowedApps = Array.isArray(payload.allowedApps)
    ? payload.allowedApps.map((a) => String(a))
    : [];
  const roles = Array.isArray(payload.roles)
    ? payload.roles.map((r) => String(r))
    : [];
  const slug = appSlug();
  return {
    user_id: String(payload.user_id),
    email: payload.email || null,
    tenant_id: payload.tenant_id || "tenant_default",
    roles,
    permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    allowedApps,
    app_allowed: allowedApps.some((a) => a.toLowerCase() === slug),
    is_guest: Boolean(payload.isGuest || payload.is_guest),
  };
}

function identityFromRequest(req) {
  if (!praveshEnabled()) return null;
  return identityFromPayload(verifyPraveshToken(extractToken(req)));
}

function appAllowed(identity) {
  if (!requireAppClaim()) return true;
  return Boolean(identity && identity.app_allowed);
}

/** Pravesh roles -> Niyantran role; unknown/absent maps to least privilege. */
function mapRole(roles) {
  for (const role of roles || []) {
    const mapped = ROLE_MAP[String(role).toLowerCase()];
    if (mapped) return mapped;
  }
  return "User";
}

/**
 * Namespaced local identity for a Pravesh principal. Never collides with a
 * local Mongo `_id` because local ids are ObjectIds and this is prefixed.
 */
function localIdentity(identity) {
  const local = IDENTITY_PREFIX + identity.user_id;
  const email = (identity.email || "").trim();
  return {
    local_id: local,
    // Guests and missing emails get a stable non-routable display address.
    email: email || `${identity.user_id}@pravesh.local`,
    role: mapRole(identity.roles),
    is_guest: identity.is_guest,
  };
}

module.exports = {
  praveshSecret,
  praveshEnabled,
  appSlug,
  cookieName,
  headerName,
  requireAppClaim,
  bridgeStatus,
  parseCookies,
  extractToken,
  verifyPraveshToken,
  identityFromPayload,
  identityFromRequest,
  appAllowed,
  mapRole,
  localIdentity,
  IDENTITY_PREFIX,
};
