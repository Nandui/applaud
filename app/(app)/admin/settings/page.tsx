import { requireAdmin } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";
import { TestEmailForm } from "./test-email-form";
import { TestChatForm } from "./test-chat-form";
import { chatConfigured } from "@/lib/chat/google-chat";
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
  const admin = await requireAdmin();
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
          <h2 className="font-semibold">Email mailbox</h2>
          <p className="text-muted text-sm">
            {sender ? `Sending from ${settings.appName} <${sender.email}>.` : "Choose the Google Workspace mailbox that will send recognition notifications."}
            {!sender && " Connecting sends a test email to the selected mailbox."}
          </p>
          {!settings.emailsEnabled && (
            <p role="status" className="text-warning text-sm font-medium">
              All emails are paused. Nothing is emailed until you turn Emails back on below.
            </p>
          )}
          {mail && Object.hasOwn(mailStatus, mail) && <p role="status" className="text-sm">{mailStatus[mail]}</p>}
          {sender && <TestEmailForm email={admin.email} />}
          <form action="/api/admin/gmail/connect" method="post">
            <Button type="submit" variant={sender ? "outline" : "default"}>{sender ? "Reconnect Gmail" : "Connect Gmail"}</Button>
          </form>
        </section>
      )}
      <SettingsForm
        settings={{
          appName: settings.appName,
          allowSelfRecognition: settings.allowSelfRecognition,
          autoCreateGoogleUsers: settings.autoCreateGoogleUsers,
          chatRecognitions: settings.chatRecognitions,
          chatCovers: settings.chatCovers,
          chatAwards: settings.chatAwards,
          chatMilestones: settings.chatMilestones,
          chatRewardClaims: settings.chatRewardClaims,
          chatSuggestions: settings.chatSuggestions,
          emailsEnabled: settings.emailsEnabled,
          emailRecognitions: settings.emailRecognitions,
          emailTeamAnnouncements: settings.emailTeamAnnouncements,
          emailInvites: settings.emailInvites,
          emailSuggestions: settings.emailSuggestions,
        }}
        chatConnected={chatConfigured()}
      />
      {chatConfigured() && (
        <section className="mt-4 max-w-xl">
          <TestChatForm />
        </section>
      )}
    </div>
  );
}
