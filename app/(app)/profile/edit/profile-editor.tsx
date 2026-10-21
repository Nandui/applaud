"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Camera, Check, Loader2, Lock, Pin, Ban } from "lucide-react";
import { updateMyProfile, setMyAvatar, type ProfileActionResult } from "@/lib/profile-actions";
import {
  BIO_MAX,
  MAX_PINNED,
  PRONOUNS_MAX,
  STATUS_MAX,
  THEME_PRESETS,
  isLight,
  type ProfileCustom,
} from "@/lib/profile-custom";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/config";
import { DecoratedAvatar, UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

type DecorationOption = { id: string; label: string; hint: string; unlocked: boolean };
type PinOption = { id: string; from: string; message: string; when: string };

const STATUS_EMOJIS = ["😎", "🔥", "🏖️", "☕", "🏊", "💪", "🎧", "🤒", "🎉", "📚"];

/**
 * Edit profile, after Discord's editor: a live preview card on top (banner,
 * ring, status bubble), then grouped sections. Everything is free; avatar
 * rings unlock by doing the things the app is about.
 */
export function ProfileEditor({
  user,
  custom,
  decorations,
  pinnable,
}: {
  user: { id: string; name: string; avatarUrl: string | null; jobTitle: string | null };
  custom: ProfileCustom;
  decorations: DecorationOption[];
  pinnable: PinOption[];
}) {
  const router = useRouter();
  const [pronouns, setPronouns] = useState(custom.pronouns);
  const [bio, setBio] = useState(custom.bio);
  const [statusEmoji, setStatusEmoji] = useState(custom.status?.emoji ?? "");
  const [statusText, setStatusText] = useState(custom.status?.text ?? "");
  const [primary, setPrimary] = useState(custom.theme.primary);
  const [accent, setAccent] = useState(custom.theme.accent);
  const [themed, setThemed] = useState(custom.themed);
  const [decoration, setDecoration] = useState(custom.decoration ?? "");
  const [pinned, setPinned] = useState<string[]>(custom.pinned);
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

  function pickPreset(p: (typeof THEME_PRESETS)[number]) {
    setPrimary(p.primary);
    setAccent(p.accent);
    setThemed(true);
  }

  function togglePin(id: string) {
    setPinned((list) => {
      if (list.includes(id)) return list.filter((x) => x !== id);
      if (list.length >= MAX_PINNED) {
        toast.error(`You can pin up to ${MAX_PINNED}.`);
        return list;
      }
      return [...list, id];
    });
  }

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
        const blob = await upload(`avatars/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/profile/avatar/upload",
          contentType: file.type,
        });
        const res = await setMyAvatar(blob.url);
        if (!res.ok) throw new Error(res.error);
        setAvatarUrl(blob.url);
        toast.success("Picture updated");
      } catch {
        toast.error("Couldn't upload that picture. Try again in a bit.");
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

  const textOnPrimary = isLight(primary) ? "#0b0b10" : "#ffffff";
  const preview = { "--p1": primary, "--p2": accent } as React.CSSProperties;

  return (
    <form action={formAction} className="mx-auto max-w-xl pb-10" style={preview}>
      <input type="hidden" name="pronouns" value={pronouns} />
      <input type="hidden" name="bio" value={bio} />
      <input type="hidden" name="statusEmoji" value={statusEmoji} />
      <input type="hidden" name="statusText" value={statusText} />
      {themed && <input type="hidden" name="themePrimary" value={primary} />}
      {themed && <input type="hidden" name="themeAccent" value={accent} />}
      <input type="hidden" name="decoration" value={decoration} />
      {pinned.map((id) => (
        <input key={id} type="hidden" name="pinned" value={id} />
      ))}

      <header className="glass pt-safe sticky top-0 z-30 -mx-4 px-4 md:mx-0 md:rounded-b-2xl">
        <div className="flex h-14 items-center">
          <Link href={`/profile/${user.id}`} className="-ml-1 px-1 text-[0.95rem] font-medium">
            Cancel
          </Link>
          <h1 className="flex-1 text-center text-[1.05rem] font-semibold tracking-tight">Edit profile</h1>
          <button
            type="submit"
            disabled={saving}
            className="text-primary h-9 px-1 text-[0.95rem] font-bold disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </button>
        </div>
      </header>

      {/* Live preview */}
      <section className="bg-surface mt-2 overflow-hidden rounded-3xl">
        <div
          className="h-24"
          style={{
            backgroundImage:
              "radial-gradient(60% 90% at 85% 10%, color-mix(in srgb, var(--p2) 85%, white 15%), transparent 60%), linear-gradient(135deg, var(--p1), var(--p2))",
          }}
        />
        <div className="px-4 pb-4">
          <div className="-mt-12 flex items-start gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group relative rounded-full"
              aria-label="Change profile picture"
            >
              <DecoratedAvatar
                name={user.name}
                avatarUrl={avatarUrl}
                decoration={decoration || null}
                className="size-22 text-xl"
                ringClassName="bg-surface"
                large
              />
              <span className="bg-foreground text-background ring-surface absolute right-1 bottom-1 flex size-8 items-center justify-center rounded-full ring-3">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </span>
            </button>
            {(statusEmoji || statusText) && (
              <p className="bg-surface-2 mt-14 max-w-[12rem] rounded-2xl px-3 py-2 text-sm font-medium">
                {statusEmoji} {statusText}
              </p>
            )}
          </div>
          <p className="font-display mt-2 text-2xl font-extrabold tracking-tight">{user.name}</p>
          <p className="text-muted text-sm">
            {[user.jobTitle, pronouns].filter(Boolean).join(" · ") || "Add your pronouns below"}
          </p>
          {bio && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{bio}</p>}
          <span
            className="mt-3 flex h-10 items-center justify-center rounded-2xl text-sm font-bold"
            style={{ backgroundColor: "var(--p1)", color: textOnPrimary }}
          >
            Preview button
          </span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            onPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </section>
      {avatarUrl && (
        <button
          type="button"
          onClick={removePhoto}
          className="text-muted mt-2 px-1 text-xs font-semibold"
        >
          Remove picture
        </button>
      )}

      <Group title="Status">
        <div className="no-scrollbar -mx-1 mb-2 flex gap-1 overflow-x-auto px-1">
          {STATUS_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setStatusEmoji(statusEmoji === e ? "" : e)}
              aria-pressed={statusEmoji === e}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl text-xl transition-colors",
                statusEmoji === e ? "bg-primary/25 ring-primary ring-2" : "bg-surface-2",
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <Field
          value={statusText}
          onChange={setStatusText}
          max={STATUS_MAX}
          placeholder="What's cookin'?"
        />
      </Group>

      <Group title="Pronouns">
        <Field value={pronouns} onChange={setPronouns} max={PRONOUNS_MAX} placeholder="e.g. she/her" />
      </Group>

      <Group title="About me">
        <div className="bg-surface-2 rounded-2xl">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            rows={4}
            placeholder="Your role, what you're into, your go-to coffee order…"
            className="placeholder:text-muted block w-full resize-none bg-transparent px-4 pt-3 outline-none"
          />
          <p data-numeric className="text-muted px-4 pb-2 text-right text-xs">
            {BIO_MAX - bio.length}
          </p>
        </div>
      </Group>

      <Group title="Profile theme" hint="Colours your banner, buttons and the top of your profile.">
        <div className="grid grid-cols-4 gap-2">
          {THEME_PRESETS.map((p) => {
            const active = themed && p.primary === primary && p.accent === accent;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPreset(p)}
                aria-pressed={active}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    "relative flex h-12 w-full items-center justify-center rounded-2xl transition-transform active:scale-95",
                    active && "ring-foreground ring-offset-background ring-2 ring-offset-2",
                  )}
                  style={{ backgroundImage: `linear-gradient(135deg, ${p.primary}, ${p.accent})` }}
                >
                  {active && <Check className="size-5 text-white drop-shadow" strokeWidth={3} />}
                </span>
                <span className="text-muted text-[0.7rem] font-semibold">{p.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ColourTile label="Primary" value={primary} onChange={(v) => { setPrimary(v); setThemed(true); }} />
          <ColourTile label="Accent" value={accent} onChange={(v) => { setAccent(v); setThemed(true); }} />
        </div>
      </Group>

      <Group title="Avatar ring" hint="Earned, never bought. Unlock more by giving and getting shout-outs.">
        <div className="grid grid-cols-4 gap-2">
          <RingTile
            label="None"
            active={!decoration}
            onClick={() => setDecoration("")}
            preview={<Ban className="text-muted size-6" />}
          />
          {decorations.map((d) => (
            <RingTile
              key={d.id}
              label={d.label}
              hint={d.unlocked ? undefined : d.hint}
              locked={!d.unlocked}
              active={decoration === d.id}
              onClick={() => (d.unlocked ? setDecoration(d.id) : toast(d.hint, { icon: "🔒" }))}
              preview={
                <span className="relative inline-flex rounded-full">
                  <UserAvatar name={user.name} avatarUrl={avatarUrl} className="size-10 text-[0.6rem]" />
                  <span aria-hidden className={cn("deco", `deco-${d.id}`)} />
                </span>
              }
            />
          ))}
        </div>
      </Group>

      <Group
        title={`Pinned shout-outs · ${pinned.length}/${MAX_PINNED}`}
        hint="Pick the ones you're proudest of. They sit at the top of your profile."
      >
        {pinnable.length === 0 ? (
          <p className="text-muted bg-surface-2 rounded-2xl p-4 text-sm">
            Once you receive shout-outs you can pin your favourites here.
          </p>
        ) : (
          <ul className="bg-surface-2 overflow-hidden rounded-2xl">
            {pinnable.map((p) => {
              const on = pinned.includes(p.id);
              return (
                <li key={p.id} className="border-border border-b last:border-0">
                  <button
                    type="button"
                    onClick={() => togglePin(p.id)}
                    aria-pressed={on}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-muted block text-xs">
                        From <span className="text-foreground font-semibold">{p.from}</span> · {p.when}
                      </span>
                      <span className="line-clamp-2 text-sm">{p.message}</span>
                    </span>
                    <span
                      className={cn(
                        "mt-1 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                        on ? "bg-lime text-lime-fg" : "bg-surface-3 text-muted",
                      )}
                    >
                      <Pin className={cn("size-3.5", on && "fill-current")} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Group>
    </form>
  );
}

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="px-1 text-sm font-bold">{title}</h2>
      {hint && <p className="text-muted mb-2 px-1 text-xs">{hint}</p>}
      <div className={cn(!hint && "mt-2")}>{children}</div>
    </section>
  );
}

function Field({
  value,
  onChange,
  max,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder: string;
}) {
  return (
    <div className="bg-surface-2 focus-within:ring-primary/50 flex items-center rounded-2xl pr-3 focus-within:ring-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        placeholder={placeholder}
        className="placeholder:text-muted h-12 min-w-0 flex-1 bg-transparent px-4 outline-none"
      />
      <span data-numeric className="text-muted text-xs">
        {max - value.length}
      </span>
    </div>
  );
}

/** Discord's Primary / Accent colour tiles: a swatch that opens the native picker. */
function ColourTile({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="bg-surface-2 relative flex h-14 cursor-pointer items-center gap-3 rounded-2xl px-3">
      <span className="border-border size-8 rounded-xl border" style={{ backgroundColor: value }} />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span data-numeric className="text-muted block text-xs uppercase">{value}</span>
      </span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} colour`}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function RingTile({
  label,
  hint,
  locked,
  active,
  onClick,
  preview,
}: {
  label: string;
  hint?: string;
  locked?: boolean;
  active: boolean;
  onClick: () => void;
  preview: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      aria-pressed={active}
      title={hint}
      className={cn(
        "bg-surface-2 relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl p-1 transition-colors",
        active && "ring-primary ring-2",
      )}
    >
      <span className={cn(locked && "opacity-55 saturate-50")}>{preview}</span>
      <span className="text-[0.7rem] font-semibold">{label}</span>
      {locked && (
        <span className="bg-surface-3 absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full">
          <Lock className="size-3" />
        </span>
      )}
    </motion.button>
  );
}
