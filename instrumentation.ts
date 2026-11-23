/**
 * Runs once when a server instance starts, before it handles requests.
 * Makes sure the runtime database has the latest additive migrations
 * (see lib/schema-repair.ts). Never blocks start-up on failure.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;
  try {
    const { repairSchema } = await import("./lib/schema-repair");
    await repairSchema();
  } catch (err) {
    console.error("[schema-repair] Failed:", err);
  }
}
