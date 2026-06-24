import { requireAdmin } from "@/lib/auth/guards";
import { getOrgSettings } from "@/lib/org-settings";
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
          monthlyAllowanceStaff: settings.monthlyAllowanceStaff,
          monthlyAllowanceManager: settings.monthlyAllowanceManager,
          pointsExpiryMonths: settings.pointsExpiryMonths,
          allowSelfRecognition: settings.allowSelfRecognition,
        }}
      />
    </div>
  );
}
