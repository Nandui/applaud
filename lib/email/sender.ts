import { prisma } from "@/lib/prisma";
import { openToken } from "./connection";
import { exchangeGoogleToken } from "./gmail";

export async function getGmailSender() {
  const connection = await prisma.gmailConnection.findUnique({ where: { id: "singleton" } });
  if (!connection) return null;
  const token = await exchangeGoogleToken({
    grant_type: "refresh_token", refresh_token: openToken(connection.encryptedToken),
  });
  return { email: connection.email, accessToken: token.access_token };
}
