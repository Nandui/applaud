import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      siteId: string;
    } & DefaultSession["user"];
  }

  // Returned by the Credentials `authorize` callback.
  interface User {
    role?: string;
    siteId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    siteId?: string;
  }
}
