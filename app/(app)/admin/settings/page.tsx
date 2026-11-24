import { requireAdmin } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
import { emailConfigured } from "@/lib/email/send";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getOrgSettings();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Organisation-wide configuration."
      />
      <SettingsForm
        settings={{
          appName: settings.appName,
          allowSelfRecognition: settings.allowSelfRecognition,
          autoCreateGoogleUsers: settings.autoCreateGoogleUsers,
          emailRecipients: settings.emailRecipients,
          emailEveryone: settings.emailEveryone,
          emailTestMode: settings.emailTestMode,
          emailTestAddress: settings.emailTestAddress,
        }}
        emailReady={emailConfigured()}
      />
    </div>
  );
}
