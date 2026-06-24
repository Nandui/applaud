import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";

/**
 * Full Auth.js config (Node runtime). Uses a dev Credentials provider:
 * sign in with any seeded user's email — no password — which makes switching
 * between the staff / manager / admin roles trivial during development.
 * Swap this provider for real auth (OAuth / email magic link) later; the rest
 * of the app reads role/site off the session and is unaffected.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
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
          siteId: user.siteId,
        };
      },
    }),
  ],
});
