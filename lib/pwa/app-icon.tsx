import { ImageResponse } from "next/og";
import { BRAND_VIOLET, MARK_HEAD, MARK_STROKE, MARK_STROKE_WIDTH } from "./mark";

/**
 * Home-screen icon: the white Yayup mark on flat brand violet. Rendered as a
 * full-bleed square — iOS and Android apply their own corner masks, and the
 * mark sits inside the maskable safe zone.
 */
export function appIcon(size: number) {
  const glyph = Math.round(size * 0.72);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_VIOLET,
        }}
      >
        <svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <path
            d={MARK_STROKE}
            fill="none"
            stroke="#ffffff"
            strokeWidth={MARK_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={MARK_HEAD.cx} cy={MARK_HEAD.cy} r={MARK_HEAD.r} fill="#ffffff" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
