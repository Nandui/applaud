import { ImageResponse } from "next/og";

/** Lucide "sparkles" glyph, the same mark the in-app Brand uses. */
const SPARKLES =
  "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z";

/**
 * Home-screen icon: the sparkles mark on the brand gradient. Rendered as a
 * full-bleed square — iOS and Android apply their own corner masks.
 */
export function appIcon(size: number) {
  const glyph = Math.round(size * 0.56);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #6d5efc 0%, #d946ef 55%, #fb7185 80%, #fbbf24 100%)",
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <path d={SPARKLES} fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
