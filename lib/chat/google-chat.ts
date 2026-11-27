import { getOrgSettings, type OrgSettings } from "@/lib/org-settings";
import { shortNameList } from "@/lib/format";

/**
 * Posts Yayup events to a Google Chat space through an incoming webhook.
 * The webhook URL lives in the GOOGLE_CHAT_WEBHOOK_URL environment variable
 * (set in Vercel, never in the database), and only production posts, so
 * previews and local runs never reach the real space. Which events go out is
 * chosen in Admin > Settings. Posting never throws: a failed post is logged
 * and the action that caused it carries on.
 */

export type ChatEvent =
  | {
      kind: "recognition"; id: string; from: string; to: string[]; value: string | null; message: string; points: number;
      image?: string | null;
      /** "everyone" / "everyone at Mahon" when it went to a whole group. */
      audience?: string | null;
    }
  | { kind: "cover"; id: string; from: string; to: string[]; what: string; points: number; image?: string | null }
  | { kind: "award"; id: string; winner: string; award: string; points: number }
  | { kind: "milestone"; id: string; message: string }
  | { kind: "claim"; person: string; reward: string; points: number }
  | { kind: "invite"; welcomePoints: number }
  | { kind: "test"; admin: string };

const settingFor = {
  recognition: "chatRecognitions",
  cover: "chatCovers",
  award: "chatAwards",
  milestone: "chatMilestones",
  claim: "chatRewardClaims",
} as const satisfies Record<Exclude<ChatEvent["kind"], "test" | "invite">, keyof OrgSettings>;

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

// Long lists collapse to "Aoife, Cian, Dara and 39 others".
function names(list: string[]) {
  return new Intl.ListFormat("en-IE", { type: "conjunction" }).format(shortNameList(list).map(clean));
}

function groupOf(audience: string, count: number) {
  return `${audience} (${count.toLocaleString("en-IE")} people)`;
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
      const who = event.audience ? clean(groupOf(event.audience, event.to.length)) : names(event.to);
      return `🎉 *${clean(event.from)}* recognised *${who}*${value}${pts(event.points, event.to.length > 1)}`
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
    case "invite":
      return `👋 *Not on ${clean(appName)} yet?* Your team is already recognising each other there. `
        + "Get recognised, earn points and choose rewards."
        + (event.welcomePoints > 0 ? ` Finish the quick tour for ${event.welcomePoints} welcome points.` : "")
        + link("/sign-in", `Join ${clean(appName)} with your work Google account`);
    case "test":
      return `👋 Test from ${clean(appName)}, sent by ${clean(event.admin)}. Notifications will appear in this space.`;
  }
}

/** Yayup's violet accent (--primary), as Google Chat's RGB 0..1 colour. */
/**
 * The button uses a deeper Yayup violet. Google Chat picks the button's text
 * colour itself and drew dark text on the lighter #6a4dff, in both themes;
 * this shade is dark enough that it always switches to white.
 */
const BUTTON_VIOLET = { red: 0x3d / 255, green: 0x22 / 255, blue: 0xb8 / 255, alpha: 1 };
const VIOLET_HEX = "#6a4dff";

/** Card text accepts a small HTML subset, so user text is HTML-escaped. */
function html(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function htmlNames(list: string[]) {
  return new Intl.ListFormat("en-IE", { type: "conjunction" }).format(shortNameList(list).map((n) => `<b>${html(n)}</b>`));
}

function htmlPoints(points: number, each: boolean) {
  if (points <= 0) return "";
  const n = points.toLocaleString("en-IE");
  return `<font color="${VIOLET_HEX}"><b>+${n} ${points === 1 ? "point" : "points"}${each ? " each" : ""}</b></font>`;
}

function htmlQuote(message: string) {
  const text = message.trim();
  if (!text) return "";
  const short = text.length > MAX_QUOTE ? `${text.slice(0, MAX_QUOTE - 1).trimEnd()}…` : text;
  return `<i>“${html(short).replace(/\s*\n+\s*/g, " ")}”</i>`;
}

type CardParts = {
  title: string;
  subtitle: string;
  lines: string[];
  image?: string | null;
  path: string;
  button: string;
};

function cardParts(appName: string, event: ChatEvent): CardParts {
  const app = appName.trim() || "Yayup";
  switch (event.kind) {
    case "recognition":
      return {
        title: "New recognition",
        subtitle: `${app} · from ${event.from}`,
        lines: [
          event.audience
            ? `🎉 <b>${html(event.from)}</b> recognised <b>${html(groupOf(event.audience, event.to.length))}</b>`
            : `🎉 ${htmlNames(event.to)} ${event.to.length > 1 ? "were" : "was"} recognised by <b>${html(event.from)}</b>`,
          event.value ? `<font color="${VIOLET_HEX}"><b>Recognised for ${html(event.value)}</b></font>` : "",
          htmlQuote(event.message),
          htmlPoints(event.points, event.to.length > 1),
        ],
        image: event.image,
        path: post(event.id),
        button: "Say congrats in Yayup",
      };
    case "cover":
      return {
        title: "Thanks for covering",
        subtitle: `${app} · from ${event.from}`,
        lines: [
          `🙌 <b>${html(event.from)}</b> thanked ${htmlNames(event.to)} for covering ${html(event.what)}`,
          htmlPoints(event.points, event.to.length > 1),
        ],
        image: event.image,
        path: post(event.id),
        button: "Open in Yayup",
      };
    case "award":
      return {
        title: "Award winner",
        subtitle: app,
        lines: [`🏆 <b>${html(event.winner)}</b> won <font color="${VIOLET_HEX}"><b>${html(event.award)}</b></font>!`, htmlPoints(event.points, false)],
        path: post(event.id),
        button: "Congratulate them in Yayup",
      };
    case "milestone":
      return {
        title: "Celebration",
        subtitle: app,
        lines: [html(event.message)],
        path: post(event.id),
        button: "Celebrate in Yayup",
      };
    case "claim":
      return {
        title: "Reward claimed",
        subtitle: app,
        lines: [`🎁 <b>${html(event.person)}</b> claimed <b>${html(event.reward)}</b> for ${event.points.toLocaleString("en-IE")} points`],
        path: "/admin/redemptions",
        button: "Open claims in Yayup",
      };
    case "invite":
      return {
        title: `Not on ${app} yet?`,
        subtitle: `${app} · your team's recognition app`,
        lines: [
          `👋 <b>Your team is already recognising each other on ${html(app)}.</b> Join in with your work Google account, it takes a minute.`,
          "<br>🎉 Get recognised when you go the extra mile",
          "⭐ Earn points from your teammates and managers",
          "🎁 Spend them on real rewards and staff discounts",
          "🎨 Make your profile yours with frames, banners and themes",
          event.welcomePoints > 0
            ? `<font color="${VIOLET_HEX}"><b>+${event.welcomePoints} welcome points</b></font> when you finish the quick tour`
            : "",
        ],
        path: "/sign-in",
        button: `Join ${app}`,
      };
    case "test":
      return {
        title: "Notifications are connected",
        subtitle: app,
        lines: [`👋 This space will now get ${html(app)} news: recognitions, thanks for covering, award winners and celebrations.`, `<i>Test sent by ${html(event.admin)}</i>`],
        path: "/",
        button: "Open Yayup",
      };
  }
}

export type ChatWidget = {
  textParagraph?: { text: string };
  image?: { imageUrl: string; altText: string };
  buttonList?: { buttons: { text: string; color: typeof BUTTON_VIOLET; onClick: { openLink: { url: string } } }[] };
};

/** The Google Chat message for one event: a branded card with a button, plus plain text for notifications. */
export function chatMessage(appName: string, event: ChatEvent, id = "yayup") {
  const parts = cardParts(appName, event);
  const url = new URL(parts.path, origin()).href;
  const widgets: ChatWidget[] = [
    { textParagraph: { text: parts.lines.filter(Boolean).join("<br>") } },
  ];
  if (parts.image) widgets.push({ image: { imageUrl: parts.image, altText: "Photo from the post" } });
  widgets.push({
    buttonList: {
      buttons: [{ text: parts.button, color: BUTTON_VIOLET, onClick: { openLink: { url } } }],
    },
  });
  return {
    fallbackText: chatText(appName, event),
    cardsV2: [{
      cardId: id,
      card: {
        header: {
          title: parts.title,
          subtitle: parts.subtitle,
          imageUrl: new URL("/brand/icon-192.png", origin()).href,
          imageType: "CIRCLE",
          imageAltText: "Yayup",
        },
        sections: [{ widgets }],
      },
    }],
  };
}

async function send(url: string, message: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(message),
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
    if (event.kind !== "test" && event.kind !== "invite" && !settings[settingFor[event.kind]]) return;
    await send(url, chatMessage(settings.appName, event));
  } catch (error) {
    console.error("Google Chat post failed", { kind: event.kind, reason: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * For the "Nudge people who haven't joined" button in Admin > Users: posts the
 * invite card regardless of the event switches. Resolves to whether Google
 * Chat accepted it; never throws.
 */
export async function postJoinInvite(welcomePoints: number): Promise<boolean> {
  if (!chatConfigured()) return false;
  try {
    const { appName } = await getOrgSettings();
    await send(chatWebhookUrl()!, chatMessage(appName, { kind: "invite", welcomePoints }, "yayup-invite"));
    return true;
  } catch (error) {
    console.error("Google Chat invite failed", { reason: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

/** For the Admin > Settings test button: posts regardless of the event switches. */
export async function sendChatTest(admin: string): Promise<string> {
  if (process.env.VERCEL_ENV !== "production") return "Google Chat tests are available on the production site.";
  const url = chatWebhookUrl();
  if (!url) return "Add the GOOGLE_CHAT_WEBHOOK_URL environment variable in Vercel and redeploy first.";
  try {
    const { appName } = await getOrgSettings();
    await send(url, chatMessage(appName, { kind: "test", admin }));
    return "Sent. Look for the test message in your Google Chat space.";
  } catch (error) {
    console.error("Google Chat test failed", { reason: error instanceof Error ? error.message : String(error) });
    return "Google Chat refused the message. Check the webhook URL in Vercel is the one copied from the space.";
  }
}
