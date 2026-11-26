import { getOrgSettings, type OrgSettings } from "@/lib/org-settings";

/**
 * Posts Yayup events to a Google Chat space through an incoming webhook.
 * The webhook URL lives in the GOOGLE_CHAT_WEBHOOK_URL environment variable
 * (set in Vercel, never in the database), and only production posts, so
 * previews and local runs never reach the real space. Which events go out is
 * chosen in Admin > Settings. Posting never throws: a failed post is logged
 * and the action that caused it carries on.
 */

export type ChatEvent =
  | { kind: "recognition"; id: string; from: string; to: string[]; value: string | null; message: string; points: number }
  | { kind: "cover"; id: string; from: string; to: string[]; what: string; points: number }
  | { kind: "award"; id: string; winner: string; award: string; points: number }
  | { kind: "milestone"; id: string; message: string }
  | { kind: "claim"; person: string; reward: string; points: number }
  | { kind: "test"; admin: string };

const settingFor = {
  recognition: "chatRecognitions",
  cover: "chatCovers",
  award: "chatAwards",
  milestone: "chatMilestones",
  claim: "chatRewardClaims",
} as const satisfies Record<Exclude<ChatEvent["kind"], "test">, keyof OrgSettings>;

const MAX_QUOTE = 400;

export function chatWebhookUrl(raw = process.env.GOOGLE_CHAT_WEBHOOK_URL): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "chat.googleapis.com") return null;
    if (!url.pathname.startsWith("/v1/spaces/") || !url.pathname.endsWith("/messages")) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Whether this deployment can post at all (production with a valid webhook). */
export function chatConfigured(): boolean {
  return process.env.VERCEL_ENV === "production" && chatWebhookUrl() !== null;
}

function origin() {
  return new URL(process.env.AUTH_URL || "https://yayup.app").origin;
}

/** Google Chat text uses <, > and & for links and mentions, so user text is escaped. */
function clean(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function names(list: string[]) {
  return new Intl.ListFormat("en-IE", { type: "conjunction" }).format(list.map(clean));
}

function pts(points: number, each: boolean) {
  if (points <= 0) return "";
  const n = points.toLocaleString("en-IE");
  return ` (+${n} ${points === 1 ? "pt" : "pts"}${each ? " each" : ""})`;
}

function quote(message: string) {
  const text = message.trim();
  if (!text) return "";
  const short = text.length > MAX_QUOTE ? `${text.slice(0, MAX_QUOTE - 1).trimEnd()}…` : text;
  return `\n_“${clean(short).replace(/\s*\n+\s*/g, " ")}”_`;
}

function link(path: string, label: string) {
  return `\n<${new URL(path, origin()).href}|${label}>`;
}

function post(id: string) {
  return `/recognition/${encodeURIComponent(id)}`;
}

/** The message text for one event, in Google Chat's simple formatting. */
export function chatText(appName: string, event: ChatEvent): string {
  switch (event.kind) {
    case "recognition": {
      const value = event.value ? ` for *${clean(event.value)}*` : "";
      return `🎉 *${clean(event.from)}* recognised *${names(event.to)}*${value}${pts(event.points, event.to.length > 1)}`
        + quote(event.message) + link(post(event.id), `See it in ${clean(appName)} and say congrats`);
    }
    case "cover":
      return `🙌 *${clean(event.from)}* thanked *${names(event.to)}* for covering ${clean(event.what)}${pts(event.points, event.to.length > 1)}`
        + link(post(event.id), `See it in ${clean(appName)}`);
    case "award":
      return `🏆 *${clean(event.winner)}* won *${clean(event.award)}*!${pts(event.points, false)}`
        + link(post(event.id), "Congratulate them");
    case "milestone":
      return clean(event.message) + link(post(event.id), `Say it in ${clean(appName)}`);
    case "claim":
      return `🎁 *${clean(event.person)}* claimed *${clean(event.reward)}* for ${event.points.toLocaleString("en-IE")} pts`
        + link("/admin/redemptions", "Open claims");
    case "test":
      return `👋 Test from ${clean(appName)}, sent by ${clean(event.admin)}. Notifications will appear in this space.`;
  }
}

async function send(url: string, text: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Google Chat answered ${response.status}: ${body.slice(0, 200)}`);
  }
}

/** Post one event if this deployment is set up for it and its switch is on. */
export async function postToGoogleChat(event: ChatEvent): Promise<void> {
  try {
    if (process.env.VERCEL_ENV !== "production") return;
    const url = chatWebhookUrl();
    if (!url) return;
    const settings = await getOrgSettings();
    if (event.kind !== "test" && !settings[settingFor[event.kind]]) return;
    await send(url, chatText(settings.appName, event));
  } catch (error) {
    console.error("Google Chat post failed", { kind: event.kind, reason: error instanceof Error ? error.message : String(error) });
  }
}

/** For the Admin > Settings test button: posts regardless of the event switches. */
export async function sendChatTest(admin: string): Promise<string> {
  if (process.env.VERCEL_ENV !== "production") return "Google Chat tests are available on the production site.";
  const url = chatWebhookUrl();
  if (!url) return "Add the GOOGLE_CHAT_WEBHOOK_URL environment variable in Vercel and redeploy first.";
  try {
    const { appName } = await getOrgSettings();
    await send(url, chatText(appName, { kind: "test", admin }));
    return "Sent. Look for the test message in your Google Chat space.";
  } catch (error) {
    console.error("Google Chat test failed", { reason: error instanceof Error ? error.message : String(error) });
    return "Google Chat refused the message. Check the webhook URL in Vercel is the one copied from the space.";
  }
}
