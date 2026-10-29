import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { lookOf } from "@/lib/profile-custom";
import { getCatalogue } from "@/lib/catalogue";
import { PostForm } from "./post-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post" };

export default async function NewPostPage() {
  const me = await requireUser();
  const [row, catalogue] = await Promise.all([
    prisma.user.findUnique({ where: { id: me.id }, select: { profile: true } }),
    getCatalogue(),
  ]);
  const look = lookOf(row?.profile, catalogue);
  return (
    <PostForm
      me={{
        name: me.name,
        avatarUrl: me.avatarUrl ?? null,
        frame: look.frame,
        banner: look.banner,
      }}
    />
  );
}
