import { appIcon } from "@/lib/pwa/app-icon";

/** PWA icons, served at /icon/192 and /icon/512 (see manifest.ts). */
export function generateImageMetadata() {
  return [192, 512].map((s) => ({
    id: String(s),
    contentType: "image/png",
    size: { width: s, height: s },
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  return appIcon(Number(await id));
}
