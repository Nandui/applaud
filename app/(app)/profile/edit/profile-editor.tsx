"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { uploadPresigned } from "@vercel/blob/client";
import { uploadErrorMessage } from "@/lib/upload-error";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";
import { updateMyProfile, setMyAvatar, type ProfileActionResult } from "@/lib/profile-actions";
import { BIO_MAX, PRONOUNS_MAX } from "@/lib/profile-limits";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";
import { UserAvatar } from "@/components/user-avatar";

/**
 * Edit profile, the Instagram screen: Cancel / Done header, the picture with
 * "Edit picture", then plain labelled fields. The look (frame, banner,
 * theme) is chosen in the profile shop, linked at the bottom.
 */
export function ProfileEditor({
  user,
  pronouns: initialPronouns,
  bio: initialBio,
  look,
}: {
  user: { id: string; name: string; avatarUrl: string | null; jobTitle: string | null };
  pronouns: string;
  bio: string;
  look: { frame: string; banner: string; theme: string };
}) {
  const router = useRouter();
  const [pronouns, setPronouns] = useState(initialPronouns);
  const [bio, setBio] = useState(initialBio);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const [, formAction, saving] = useActionState<ProfileActionResult | undefined, FormData>(
    async (prev, fd) => {
      const res = await updateMyProfile(prev, fd);
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.push(`/profile/${user.id}`);
      } else {
        toast.error(res.error);
      }
      return res;
    },
    undefined,
  );

  function onPhoto(file: File | undefined) {
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Use a PNG, JPG, GIF, or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Pictures must be 8MB or smaller.");
      return;
    }
    startUpload(async () => {
      try {
        const blob = await uploadPresigned(`avatars/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/profile/avatar/upload",
          contentType: file.type,
        });
        const res = await setMyAvatar(blob.url);
        if (!res.ok) throw new Error(res.error);
        setAvatarUrl(blob.url);
        toast.success("Picture updated");
      } catch (error) {
        toast.error(uploadErrorMessage(error, "Couldn't upload that picture."));
      }
    });
  }

  function removePhoto() {
    startUpload(async () => {
      const res = await setMyAvatar(null);
      if (res.ok) setAvatarUrl(null);
      else toast.error(res.error);
    });
  }

  return (
    <form action={formAction} className="mx-auto max-w-xl pb-10">
      <header className="glass pt-safe border-border sticky top-0 z-30 -mx-4 border-b md:mx-0">
        <div className="relative flex h-12 items-center justify-between px-4">
          <Link href={`/profile/${user.id}`} className="text-[0.95rem]">
            Cancel
          </Link>
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[0.95rem] font-bold">
            Edit profile
          </h1>
          <button
            type="submit"
            disabled={saving}
            className="text-primary relative text-[0.95rem] font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Done"}
          </button>
        </div>
      </header>

      <div className="flex flex-col items-center gap-2 py-6">
        <UserAvatar name={user.name} avatarUrl={avatarUrl} className="size-22 text-2xl" />
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => onPhoto(e.target.files?.[0])}
        />
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="text-primary text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Edit picture"}
          </button>
          {avatarUrl ? (
            <button type="button" disabled={uploading} onClick={removePhoto} className="text-danger text-sm font-semibold">
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="border-border divide-border divide-y border-y">
        <Row label="Name">
          <p className="py-3">{user.name}</p>
        </Row>
        <Row label="Pronouns">
          <input
            name="pronouns"
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            maxLength={PRONOUNS_MAX}
            placeholder="e.g. she/her"
            className="placeholder:text-muted w-full bg-transparent py-3 outline-none"
          />
        </Row>
        <Row label="Bio">
          <textarea
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="A line or two about you"
            className="placeholder:text-muted block w-full resize-none bg-transparent py-3 outline-none"
          />
          <p className="text-muted -mt-1 pb-2 text-right text-xs" data-numeric>
            {bio.length}/{BIO_MAX}
          </p>
        </Row>
      </div>
      <p className="text-muted px-1 pt-2 text-xs">Your name and job title are set by your admin.</p>

      <h2 className="mt-8 mb-2 px-1 text-sm font-bold">Your look</h2>
      <div className="border-border divide-border divide-y border-y">
        {[
          { label: "Avatar frame", value: look.frame },
          { label: "Banner", value: look.banner },
          { label: "Theme", value: look.theme },
        ].map((r) => (
          <Link key={r.label} href="/shop" className="flex items-center gap-3 py-3 active:opacity-60">
            <span className="w-28 shrink-0">{r.label}</span>
            <span className="text-muted flex-1 truncate">{r.value}</span>
            <ChevronRight className="text-muted size-4.5" />
          </Link>
        ))}
      </div>
      <p className="text-muted px-1 pt-2 text-xs">Change these in the profile shop, using your points.</p>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-28 shrink-0 py-3">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
