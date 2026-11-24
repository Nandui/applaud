import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getCardsByIds } from "@/lib/recognition/queries";
import { prisma } from "@/lib/prisma";
import { parseProfile } from "@/lib/profile-custom";
import { RecognitionCard } from "@/components/feed/recognition-card";

export const metadata = { title: "Team recognition" };

export default async function RecognitionPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const [[card], user] = await Promise.all([
    getCardsByIds([id], me.id, { kind: "recognition", visibility: "public" }),
    prisma.user.findUnique({ where: { id: me.id }, select: { profile: true } }),
  ]);
  if (!card) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/" className="text-primary mb-4 inline-block text-sm font-semibold">Back to feed</Link>
      <RecognitionCard card={card} viewer={{ id: me.id, name: me.name, avatarUrl: me.avatarUrl, role: me.role }}
        pinned={parseProfile(user?.profile).pinned.includes(id)} />
    </div>
  );
}
