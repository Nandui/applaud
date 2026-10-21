import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getProfileData } from "@/lib/profile";
import { DEFAULT_BANNER, DEFAULT_THEME, itemById } from "@/lib/cosmetics";
import { wornItem } from "@/lib/profile-custom";
import { ProfileEditor } from "./profile-editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const me = await requireUser();
  const data = await getProfileData(me.id);
  if (!data) notFound();
  const { custom, catalogue } = data;
  const worn = (kind: "frame" | "banner" | "theme") => wornItem(custom, kind, catalogue)?.name;

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
        frame: worn("frame") ?? "None",
        banner: worn("banner") ?? itemById(catalogue, DEFAULT_BANNER)?.name ?? "Default",
        theme: worn("theme") ?? itemById(catalogue, DEFAULT_THEME)?.name ?? "Default",
      }}
    />
  );
}
