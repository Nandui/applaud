import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/lib/config";

/**
 * Edge/proxy-safe Auth.js config: no providers, no Prisma adapter — just the
 * pages, JWT, and session callbacks. The proxy (middleware) instantiates
 * NextAuth with this to read the session token; the full config (with the
 * Credentials provider + Prisma adapter) lives in auth.ts for the Node runtime.
 */
export const authConfig = {
  pages: { signIn: "/sign-in" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.siteId = user.siteId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? session.user.id;
        session.user.role = (token.role as Role) ?? "staff";
        session.user.siteId = token.siteId as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
