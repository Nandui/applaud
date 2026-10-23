import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { Provider } from "next-auth/providers";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import {
  devSignInEnabled,
  googleAllowedDomains,
  googleSignInEnabled,
} from "@/lib/auth/mode";
import { syncGoogleAvatar } from "@/lib/google-avatar";
import { normaliseEmail, resolveGoogleUser } from "@/lib/auth/google-account";

/**
 * Full Auth.js config (Node runtime).
 *
 * Google (Workspace) is the real sign-in, only from the AUTH_GOOGLE_DOMAIN
 * workspace(s). People are matched to their user by email; someone from the
 * workspace with no user yet gets a staff account on their first sign-in
 * unless an admin has switched that off (lib/auth/google-account.ts).
 * Deactivated users stay out.
 *
 * The dev Credentials provider (any active user's email, no password) is only
 * registered off production — see lib/auth/mode.ts. The rest of the app reads
 * role/site off the session and doesn't care which provider was used.
 */
const providers: Provider[] = [];

if (googleSignInEnabled) {
  providers.push(
    Google({
      // The signIn callback below makes sure a user row exists for the email
      // (added by an admin, the roster import, or created there), so the first
      // Google sign-in links to that row. Safe because it only accepts
      // verified emails from our own workspace.
      allowDangerousEmailAccountLinking: true,
      // Lower-case the email Auth.js matches users by, like every stored email.
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: normaliseEmail(profile.email),
          image: profile.picture,
        };
      },
      authorization: {
        params: {
          prompt: "select_account",
          // Hint Google to list only workspace accounts; enforced below.
          ...(googleAllowedDomains.length === 1 ? { hd: googleAllowedDomains[0] } : {}),
        },
      },
    }),
  );
}

if (devSignInEnabled) {
  providers.push(
    Credentials({
      name: "Dev login",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        if (!email) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl ?? undefined,
          role: user.role,
          siteId: user.siteId ?? undefined,
        };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const email = normaliseEmail(profile?.email);
      const domain = email.split("@")[1] ?? "";
      if (!email || profile?.email_verified !== true) {
        return "/sign-in?error=GoogleUnverified";
      }
      if (googleAllowedDomains.length > 0 && !googleAllowedDomains.includes(domain)) {
        return "/sign-in?error=WrongDomain";
      }
      const result = await resolveGoogleUser(email, profile ?? {}, {
        // Without a workspace domain configured any Google account gets this
        // far, so nobody is created then.
        mayCreate: googleAllowedDomains.length > 0,
      });
      if (!result.ok) return `/sign-in?error=${result.error}`;
      // Their Google picture becomes their avatar unless they've set their own.
      await syncGoogleAvatar(result.user, profile?.picture);
      return true;
    },
  },
});
