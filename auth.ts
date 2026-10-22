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

/**
 * Full Auth.js config (Node runtime).
 *
 * Google (Workspace) is the real sign-in: only people an admin has already
 * added as active users get in, matched by email, and only from the
 * AUTH_GOOGLE_DOMAIN workspace(s). Nobody is created on first sign-in.
 *
 * The dev Credentials provider (any active user's email, no password) is only
 * registered off production — see lib/auth/mode.ts. The rest of the app reads
 * role/site off the session and doesn't care which provider was used.
 */
const providers: Provider[] = [];

if (googleSignInEnabled) {
  providers.push(
    Google({
      // Users are pre-created by admins (or the roster import) with their work
      // email, so the first Google sign-in links to that row. Safe because the
      // signIn callback only accepts verified emails from our own workspace.
      allowDangerousEmailAccountLinking: true,
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
  session: { strategy: "jwt" },
  trustHost: true,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const email = String(profile?.email ?? "").trim().toLowerCase();
      const domain = email.split("@")[1] ?? "";
      if (!email || profile?.email_verified !== true) {
        return "/sign-in?error=GoogleUnverified";
      }
      if (googleAllowedDomains.length > 0 && !googleAllowedDomains.includes(domain)) {
        return "/sign-in?error=WrongDomain";
      }
      const user = await prisma.user.findUnique({
        where: { email },
        select: { active: true },
      });
      if (!user || !user.active) return "/sign-in?error=NotInvited";
      return true;
    },
  },
});
