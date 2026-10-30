/**
 * Timings for live comments and the "is typing…" line. Shared by the poll
 * endpoint (app/api/recognition/[id]/live) and the card that polls it.
 *
 * There is no socket server on Vercel, so the card polls: quickly while its
 * comments are open, slowly while it is merely on screen, never while the
 * tab is hidden or the card is scrolled away.
 */

/** Poll this often while the comments sheet is open. */
export const LIVE_OPEN_MS = 2_000;
/** Poll this often while the card is on screen with comments closed. */
export const LIVE_VISIBLE_MS = 6_000;
/** While someone keeps typing, tell the server at most this often. */
export const TYPING_PING_MS = 3_000;
/** Someone counts as typing for this long after their last ping. */
export const TYPING_FRESH_MS = 7_000;

export type TypingUser = { id: string; name: string };

/** "Ana is typing…", "Ana and Ben are typing…", "3 people are typing…". */
export function typingLabel(users: TypingUser[]): string | null {
  const first = (u: TypingUser) => u.name.split(" ")[0] || u.name;
  if (users.length === 0) return null;
  if (users.length === 1) return `${first(users[0])} is typing`;
  if (users.length === 2) return `${first(users[0])} and ${first(users[1])} are typing`;
  return `${users.length} people are typing`;
}
