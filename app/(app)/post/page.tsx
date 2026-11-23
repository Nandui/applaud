import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { lookOf } from "@/lib/profile-custom";
import { getCatalogue } from "@/lib/catalogue";
import { canCreatePollsAndQuestions } from "@/lib/posts/kinds";
import { PostForm, type ComposerType } from "./post-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "New post" };

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const me = await requireUser();
  const { type } = await searchParams;
  const canAsk = canCreatePollsAndQuestions(me);
  const initialType: ComposerType = canAsk && (type === "poll" || type === "question") ? type : "post";
  const [row, catalogue, sites] = await Promise.all([
    prisma.user.findUnique({ where: { id: me.id }, select: { profile: true } }),
    getCatalogue(),
    canAsk
      ? prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const look = lookOf(row?.profile, catalogue);
  return (
    <PostForm
      canAsk={canAsk}
      sites={sites}
      initialType={initialType}
      me={{
        name: me.name,
        avatarUrl: me.avatarUrl ?? null,
        frame: look.frame,
        banner: look.banner,
      }}
    />
  );
}
