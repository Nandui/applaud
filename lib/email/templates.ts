/**
 * Recognition emails, as plain HTML strings that work in Gmail, Outlook and
 * Apple Mail: table layout, inline styles, absolute image URLs, no web fonts.
 * No server-only imports, so scripts/email-previews.ts can render them too.
 */

export type EmailPerson = { name: string; avatarUrl: string | null };

export type RecognitionEmailData = {
  appName: string;
  /** e.g. https://yayup.app (no trailing slash) */
  appUrl: string;
  /** Where the buttons go: the post in the feed. */
  postUrl: string;
  kind: "recognition" | "cover";
  sender: EmailPerson;
  recipients: EmailPerson[];
  valueName: string | null;
  valueImageUrl: string | null;
  /** For covers: what was covered, e.g. "the 6pm swim lesson". */
  coverWhat: string | null;
  message: string;
  /** Points each recipient got. */
  points: number;
  /** First photo or GIF on the post, if any. */
  imageUrl: string | null;
};

export type RenderedEmail = { subject: string; html: string; text: string };

/** Shown at the top of every email while test mode is on. */
export type TestNote = { wouldGoTo: string; sample?: boolean };

const VIOLET = "#6a4dff";
const VIOLET_SOFT = "#f3f0ff";
const INK = "#16131f";
const MUTED = "#6b6780";
const PAGE_BG = "#f4f2fa";
const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function isHttpUrl(url: string): boolean {
  return Boolean(url && /^https:\/\//i.test(url));
}

/** Absolute https URL for an image path, or null. */
function absolute(url: string | null | undefined, appUrl: string): string | null {
  if (!url) return null;
  if (isHttpUrl(url)) return url;
  if (url.startsWith("/")) return `${appUrl}${url}`;
  return null;
}

function avatar(person: EmailPerson, size: number, appUrl: string, ring = "#ffffff"): string {
  const src = absolute(person.avatarUrl, appUrl);
  const round = `width:${size}px;height:${size}px;border-radius:${size / 2 + 3}px;border:3px solid ${ring};`;
  if (src) {
    return `<img src="${esc(src)}" width="${size}" height="${size}" alt="${esc(person.name)}" style="display:block;${round}object-fit:cover;" />`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="${size}" height="${size}" align="center" valign="middle" style="${round}background:${VIOLET};color:#ffffff;font:700 ${Math.round(size * 0.36)}px/${size}px ${FONT};">${esc(initials(person.name))}</td></tr></table>`;
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td align="center" bgcolor="${VIOLET}" style="border-radius:999px;background:${VIOLET};">
<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:15px 34px;font:700 16px ${FONT};color:#ffffff;text-decoration:none;border-radius:999px;">${esc(label)}</a>
</td></tr></table>`;
}

function testBanner(note: TestNote | undefined): string {
  if (!note) return "";
  return `<tr><td style="padding:0 0 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#fff6d6;border:1px solid #f1d97a;border-radius:14px;padding:12px 16px;font:500 13px/1.45 ${FONT};color:#6b5200;">
${note.sample ? "<strong>Sample email</strong> sent from Admin &gt; Settings. For real, this goes to" : "<strong>Test email.</strong> Test mode is on, so this came only to you. When it's off, this goes to"} ${esc(note.wouldGoTo)}.
</td></tr></table></td></tr>`;
}

function shell(opts: { appName: string; appUrl: string; preheader: string; body: string; footer: string; test?: TestNote }): string {
  const logo = `${opts.appUrl}/brand/yayup-logo.png`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(opts.appName)}</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(opts.preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE_BG};"><tr><td align="center" style="padding:28px 14px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
${testBanner(opts.test)}
<tr><td align="center" style="padding:4px 0 20px;"><a href="${esc(opts.appUrl)}" target="_blank"><img src="${esc(logo)}" width="128" height="28" alt="${esc(opts.appName)}" style="display:block;width:128px;height:auto;border:0;" /></a></td></tr>
<tr><td style="background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 10px 30px rgba(60,40,140,0.08);">
${opts.body}
</td></tr>
<tr><td align="center" style="padding:22px 24px 0;font:400 12px/1.5 ${FONT};color:${MUTED};">${opts.footer}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ---------------------------------------------------------------------------
// To each recipient
// ---------------------------------------------------------------------------

export function recipientEmail(data: RecognitionEmailData, me: EmailPerson, test?: TestNote): RenderedEmail {
  const isCover = data.kind === "cover";
  const senderName = data.sender.name;
  const others = data.recipients.filter((r) => r.name !== me.name).map((r) => firstName(r.name));
  const what = isCover
    ? `for covering ${data.coverWhat || "a shift"}`
    : data.valueName
      ? `for ${data.valueName}`
      : "";

  const subject = isCover
    ? `🙌 ${senderName} thanked you for covering`
    : `🎉 ${senderName} recognised you${data.valueName ? ` for ${data.valueName}` : ""}`;
  const heading = isCover ? `Thank you, ${firstName(me.name)}!` : `You've been recognised, ${firstName(me.name)}!`;
  const lead = isCover
    ? `<strong>${esc(senderName)}</strong> thanked you ${esc(what)} at short notice.`
    : `<strong>${esc(senderName)}</strong> just recognised you${what ? ` ${esc(what)}` : ""}.`;

  const valueImg = absolute(data.valueImageUrl, data.appUrl);
  const badge =
    !isCover && data.valueName
      ? `<tr><td style="padding:24px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${VIOLET_SOFT};border-radius:18px;padding:14px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
${valueImg ? `<td valign="middle" style="padding-right:14px;"><img src="${esc(valueImg)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border:0;" /></td>` : ""}
<td valign="middle" style="font:500 12px/1.3 ${FONT};color:${MUTED};text-transform:uppercase;letter-spacing:0.08em;">Recognised for<br><span style="font:800 20px/1.25 ${FONT};color:${VIOLET};text-transform:none;letter-spacing:0;">${esc(data.valueName)}</span></td>
</tr></table></td></tr></table></td></tr>`
      : "";

  const picture = absolute(data.imageUrl, data.appUrl);
  const pictureRow = picture
    ? `<tr><td style="padding:20px 28px 0;"><img src="${esc(picture)}" width="504" alt="" style="display:block;width:100%;max-width:504px;height:auto;border-radius:18px;border:0;" /></td></tr>`
    : "";

  const quote = data.message.trim()
    ? `<tr><td style="padding:22px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="top" width="48" style="padding-right:12px;">${avatar(data.sender, 44, data.appUrl, VIOLET_SOFT)}</td>
<td valign="top">
<div style="font:700 14px ${FONT};color:${INK};padding:2px 0 6px;">${esc(senderName)}</div>
<div style="background:#f6f5fa;border-radius:4px 18px 18px 18px;padding:14px 16px;font:400 16px/1.55 ${FONT};color:${INK};white-space:pre-line;">${esc(data.message.trim())}</div>
</td></tr></table></td></tr>`
    : "";

  const pointsRow =
    data.points > 0
      ? `<tr><td align="center" style="padding:26px 28px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background:#fff3e6;border-radius:999px;padding:10px 20px;font:800 18px ${FONT};color:#c2570c;">⭐ +${data.points.toLocaleString("en-IE")} points</td></tr></table>
<div style="font:400 14px/1.5 ${FONT};color:${MUTED};padding-top:10px;">Added to your wallet. Spend them on rewards or a new look for your profile.</div>
</td></tr>`
      : "";

  const shared = others.length
    ? `<tr><td align="center" style="padding:18px 28px 0;font:400 14px/1.5 ${FONT};color:${MUTED};">Shared with ${esc(listNames(others))} 💜</td></tr>`
    : "";

  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" bgcolor="${VIOLET}" style="background:${VIOLET};background-image:linear-gradient(135deg,#7c5cff 0%,#d14dff 55%,#ff4f9a 100%);padding:34px 28px 30px;">
<div style="font-size:44px;line-height:1;padding-bottom:12px;">${isCover ? "🙌" : "🎉"}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td>${avatar(me, 88, data.appUrl)}</td></tr></table>
<h1 style="margin:16px 0 6px;font:800 28px/1.2 ${FONT};color:#ffffff;">${esc(heading)}</h1>
<p style="margin:0;font:400 16px/1.5 ${FONT};color:#ffffff;opacity:0.95;">${lead}</p>
</td></tr>
${badge}
${quote}
${pictureRow}
${pointsRow}
${shared}
<tr><td style="padding:30px 28px 10px;">${button(data.postUrl, `See it on ${data.appName}`)}</td></tr>
<tr><td align="center" style="padding:6px 36px 32px;font:400 14px/1.5 ${FONT};color:${MUTED};">It's in the feed for everyone to see. Pop in to read the comments and say thanks.</td></tr>
</table>`;

  const html = shell({
    appName: data.appName,
    appUrl: data.appUrl,
    preheader: isCover ? `${senderName} says thank you for covering.` : `${senderName}: "${data.message.trim().slice(0, 90)}"`,
    body,
    footer: `You're getting this because someone recognised you on ${esc(data.appName)}.<br><a href="${esc(data.appUrl)}" style="color:${MUTED};">${esc(data.appUrl.replace(/^https?:\/\//, ""))}</a>`,
    test,
  });

  const text = [
    heading,
    "",
    `${senderName} ${isCover ? `thanked you ${what}` : `recognised you${what ? ` ${what}` : ""}`}.`,
    data.message.trim() ? `\n"${data.message.trim()}"` : "",
    data.points > 0 ? `\n+${data.points} points added to your wallet.` : "",
    others.length ? `\nShared with ${listNames(others)}.` : "",
    `\nSee it on ${data.appName}: ${data.postUrl}`,
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// To everyone else: someone got recognised, come and see who
// ---------------------------------------------------------------------------

export function everyoneEmail(data: RecognitionEmailData, test?: TestNote): RenderedEmail {
  const isCover = data.kind === "cover";
  const n = data.recipients.length;
  const who = n === 1 ? "a colleague" : `${n} colleagues`;
  const senderName = data.sender.name;

  const subject = isCover
    ? `🙌 ${firstName(senderName)} just thanked someone for covering`
    : `👀 Someone just got recognised on ${data.appName}`;
  const heading = isCover ? "Someone saved the day" : "Someone just got recognised!";
  const lead = isCover
    ? `<strong>${esc(senderName)}</strong> just thanked ${who} for covering ${esc(data.coverWhat || "at short notice")}.`
    : `<strong>${esc(senderName)}</strong> just recognised ${who}${data.valueName ? ` for <strong>${esc(data.valueName)}</strong>` : ""}.`;

  // Mystery avatars: one "?" bubble per recipient (up to 4).
  const bubbles = Array.from({ length: Math.min(n, 4) })
    .map(
      () =>
        `<td style="padding:0 5px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="64" height="64" align="center" valign="middle" bgcolor="${VIOLET}" style="width:64px;height:64px;border-radius:35px;background:${VIOLET};background-image:linear-gradient(135deg,#7c5cff 0%,#d14dff 55%,#ff4f9a 100%);border:3px solid #ffffff;color:#ffffff;font:800 30px/64px ${FONT};">?</td></tr></table></td>`,
    )
    .join("");
  const more = n > 4 ? `<td style="padding:0 5px;font:700 16px ${FONT};color:${VIOLET};">+${n - 4}</td>` : "";

  const valueImg = !isCover ? absolute(data.valueImageUrl, data.appUrl) : null;

  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="background:${VIOLET_SOFT};padding:34px 28px 30px;">
<div style="font-size:40px;line-height:1;padding-bottom:16px;">${isCover ? "🙌" : "👀"}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${bubbles}${more}</tr></table>
<h1 style="margin:18px 0 8px;font:800 26px/1.2 ${FONT};color:${INK};">${esc(heading)}</h1>
<p style="margin:0;font:400 16px/1.5 ${FONT};color:${INK};">${lead}</p>
${valueImg ? `<img src="${esc(valueImg)}" width="64" height="64" alt="" style="display:block;margin:18px auto 0;width:64px;height:64px;border:0;" />` : ""}
</td></tr>
<tr><td align="center" style="padding:28px 36px 4px;font:400 16px/1.55 ${FONT};color:${INK};">Sign in to find out who ${n === 1 ? "it is" : "they are"}, then share your happiness with a reaction or a comment. A few kind words go a long way 💜</td></tr>
<tr><td style="padding:24px 28px 34px;">${button(data.postUrl, n === 1 ? "See who it is" : "See who they are")}</td></tr>
</table>`;

  const html = shell({
    appName: data.appName,
    appUrl: data.appUrl,
    preheader: isCover ? `${senderName} thanked ${who} for covering. Come and see who.` : `${senderName} recognised ${who}. Come and see who.`,
    body,
    footer: `You're getting this because you're on ${esc(data.appName)}, where we celebrate each other at work.<br><a href="${esc(data.appUrl)}" style="color:${MUTED};">${esc(data.appUrl.replace(/^https?:\/\//, ""))}</a>`,
    test,
  });

  const text = [
    heading,
    "",
    isCover
      ? `${senderName} just thanked ${who} for covering ${data.coverWhat || "at short notice"}.`
      : `${senderName} just recognised ${who}${data.valueName ? ` for ${data.valueName}` : ""}.`,
    "",
    `Sign in to find out who ${n === 1 ? "it is" : "they are"}, then share your happiness with a reaction or a comment.`,
    "",
    `See who it is: ${data.postUrl}`,
  ].join("\n");

  return { subject, html, text };
}
