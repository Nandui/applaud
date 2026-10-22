// Profile field limits, shared by the validator (lib/profile-custom.ts) and
// the editor. Kept zod-free so the browser bundle stays small.

export const BIO_MAX = 150;
export const PRONOUNS_MAX = 24;
export const MAX_PINNED = 3;
