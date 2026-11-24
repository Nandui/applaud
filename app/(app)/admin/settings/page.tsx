import { requireAdmin } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { googleSignInEnabled } from "@/lib/auth/mode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

const mailStatus: Record<string, string> = {
  connected: "Gmail accepted the test email. Recognition notifications are enabled.",
  workspace: "Choose a mailbox in your organisation's Google Workspace.",
  expired: "The connection request expired. Start again from this page.",
  cancelled: "Google consent was cancelled.",
  permission: "Google needs permission to send mail and keep the mailbox connected. Please try again.",
  "api-disabled": "Enable the Gmail API in the Google Cloud project used for Yayup sign-in, then connect again.",
  unavailable: "Connect the mailbox on the production site.",
  failed: "The mailbox connection failed. Check the Google permission and try again.",
};

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ mail?: string }> }) {
  await requireAdmin();
  const settings = await getOrgSettings();
  const enabled = process.env.VERCEL_ENV === "production" && googleSignInEnabled;
  const sender = enabled ? await prisma.gmailConnection.findUnique({
    where: { id: "singleton" }, select: { email: true },
  }) : null;
  const { mail } = await searchParams;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Organisation-wide configuration."
      />
      {enabled && (
        <section id="gmail" className="border-border mt-6 max-w-xl space-y-3 rounded-xl border p-4">
          <h2 className="font-semibold">Recognition emails</h2>
          <p className="text-muted text-sm">
            {sender ? `Sending from ${settings.appName} <${sender.email}>.` : "Choose the Google Workspace mailbox that will send recognition notifications."}
            {" "}Connecting sends a test email to the selected mailbox.
          </p>
          {mail && Object.hasOwn(mailStatus, mail) && <p role="status" className="text-sm">{mailStatus[mail]}</p>}
          <form action="/api/admin/gmail/connect" method="post">
            <Button type="submit">{sender ? "Reconnect Gmail" : "Connect Gmail"}</Button>
          </form>
        </section>
      )}
      <SettingsForm
        settings={{
          appName: settings.appName,
          allowSelfRecognition: settings.allowSelfRecognition,
          autoCreateGoogleUsers: settings.autoCreateGoogleUsers,
        }}
      />
    </div>
  );
}
