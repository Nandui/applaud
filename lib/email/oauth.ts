import { createHash, randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { decode, encode } from "next-auth/jwt";
import { requireAdmin } from "@/lib/auth/guards";
import { googleAllowedDomains, googleSignInEnabled } from "@/lib/auth/mode";
import { getOrgSettings } from "@/lib/org-settings";
import { prisma } from "@/lib/prisma";
import { sealToken } from "./connection";
import { exchangeGoogleToken, gmailScope, mailbox, sendGmail } from "./gmail";

const cookie = "__Host-yayup-mail-consent";
export const statePrefix = "yayup-mail.";
const callbackPath = "/api/auth/callback/google";

function finish(request: NextRequest, status: string) {
  const result = new URL("/admin/settings", request.nextUrl.origin);
  result.searchParams.set("mail", status);
  const response = NextResponse.redirect(result, 303);
  response.cookies.set(cookie, "", { secure: true, httpOnly: true, path: "/", maxAge: 0 });
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function startConsent(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production" || !googleSignInEnabled) return finish(request, "unavailable");
  if (request.headers.get("origin") !== request.nextUrl.origin) return new Response(null, { status: 403 });
  const admin = await requireAdmin();
  const state = statePrefix + randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const redirectUri = new URL(callbackPath, request.nextUrl.origin).href;
  const flow = await encode({
    secret: process.env.AUTH_SECRET!, salt: cookie, maxAge: 600,
    token: { sub: admin.id, state, verifier, redirectUri },
  });
  const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  consent.search = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID!, redirect_uri: redirectUri, response_type: "code",
    scope: `openid email ${gmailScope}`, access_type: "offline", prompt: "select_account consent",
    state, code_challenge_method: "S256",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  }).toString();
  const response = NextResponse.redirect(consent, 303);
  response.cookies.set(cookie, flow, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function completeConsent(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "production") return finish(request, "unavailable");
  const admin = await requireAdmin();
  const params = request.nextUrl.searchParams;
  try {
    const flow = await decode({
      secret: process.env.AUTH_SECRET!, salt: cookie, token: request.cookies.get(cookie)?.value,
    });
    const redirectUri = new URL(callbackPath, request.nextUrl.origin).href;
    if (!flow || flow.sub !== admin.id || flow.state !== params.get("state") ||
        flow.redirectUri !== redirectUri || typeof flow.verifier !== "string") return finish(request, "expired");
    const code = params.get("code");
    if (!code) return finish(request, "cancelled");
    const token = await exchangeGoogleToken({
      grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: flow.verifier,
    });
    if (!token.refresh_token || !token.scope?.split(" ").includes(gmailScope)) return finish(request, "permission");
    const identity = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (!identity.ok) return finish(request, "failed");
    const profile = await identity.json();
    if (profile.email_verified !== true || !mailbox.safeParse(profile.email).success ||
        typeof profile.hd !== "string" || !googleAllowedDomains.includes(profile.hd.toLowerCase())) {
      return finish(request, "workspace");
    }
    const settings = await getOrgSettings();
    const data = { email: profile.email as string, encryptedToken: sealToken(token.refresh_token), connectedAt: new Date() };
    await sendGmail(token.access_token, data.email, settings.appName, data.email,
      "Your notification mailbox is connected",
      `This is the connection test for ${settings.appName}. Recognition emails will come from this mailbox.`);
    await prisma.gmailConnection.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
    return finish(request, "connected");
  } catch (error) {
    return finish(request, error instanceof Error && error.message === "gmail-api-disabled" ? "api-disabled" : "failed");
  }
}
