import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getProfileData } from "@/lib/profile";
import { cosmeticById } from "@/lib/cosmetics";
import { ProfileEditor } from "./profile-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const me = await requireUser();
  const data = await getProfileData(me.id);
  if (!data) notFound();
  const { custom } = data;

  return (
    <ProfileEditor
      user={{
        id: data.user.id,
        name: data.user.name,
        avatarUrl: data.user.avatarUrl,
        jobTitle: data.user.jobTitle,
      }}
      pronouns={custom.pronouns}
      bio={custom.bio}
      look={{
        frame: cosmeticById(custom.frame)?.name ?? "None",
        banner: cosmeticById(custom.banner)?.name ?? "Violet",
        theme: cosmeticById(custom.theme)?.name ?? "Violet",
      }}
    />
  );
}
