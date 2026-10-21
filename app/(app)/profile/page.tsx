import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

/** /profile with no id — send the signed-in user to their own page. */
export default async function ProfileIndexPage() {
  const user = await requireUser();
  redirect(`/profile/${user.id}`);
}
