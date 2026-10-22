// Kept apart from lib/profile-custom.ts (which needs zod) so client
// components can use it without shipping zod to the browser.

/** Relative luminance check so text on an accent colour stays readable. */
export function isLight(hexColour: string): boolean {
  const h = hexColour.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45;
}
