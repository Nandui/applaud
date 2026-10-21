import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getProfileData } from "@/lib/profile";
import { getReceivedCards } from "@/lib/recognition/queries";
import { DECORATIONS } from "@/lib/profile-custom";
import { ProfileEditor } from "./profile-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const me = await requireUser();
  const data = await getProfileData(me.id);
  if (!data) notFound();
  const received = await getReceivedCards(me.id, me.id, 30);

  return (
    <ProfileEditor
      user={{
        id: data.user.id,
        name: data.user.name,
        avatarUrl: data.user.avatarUrl,
        jobTitle: data.user.jobTitle,
      }}
      custom={data.custom}
      decorations={DECORATIONS.map((d) => ({
        id: d.id,
        label: d.label,
        hint: d.hint,
        unlocked: data.unlocked.has(d.id),
      }))}
      pinnable={received
        .filter((c) => !c.system)
        .map((c) => ({
          id: c.id,
          from: c.sender.name,
          message: c.message,
          when: c.createdAtLabel,
        }))}
    />
  );
}
