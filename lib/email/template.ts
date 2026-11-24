export type Notification =
  | { kind: "recognition"; recognisedBy: string; points: number }
  | { kind: "test"; recipientName: string }
  | { kind: "connected" };

function copyFor(appName: string, notification: Notification) {
  switch (notification.kind) {
    case "recognition":
      return {
        subject: "You received a recognition", label: "Team recognition", title: "You got a shout‑out!",
        preview: `${notification.recognisedBy} recognised you on ${appName}.`,
        paragraphs: [`${notification.recognisedBy} recognised you on ${appName}. Open your feed to see what they shared.`],
        points: notification.points > 0 ? `+${notification.points.toLocaleString("en-IE")} ${notification.points === 1 ? "point" : "points"}` : "",
        action: "View your feed", path: "/",
      };
    case "test":
      return {
        subject: "Notification email test", label: "Delivery test", title: "Your test email is here.",
        preview: `A test from your ${appName} notification mailbox.`,
        paragraphs: [`Hi ${notification.recipientName},`, `This is the test you requested in ${appName}. You can send another from your email settings anytime.`],
        points: "", action: "Open email settings", path: "/admin/settings#gmail",
      };
    case "connected":
      return {
        subject: "Your notification mailbox is connected", label: "Mailbox setup", title: "Ready to send.",
        preview: `This mailbox can now send recognition emails for ${appName}.`,
        paragraphs: [`This is the mailbox you selected for ${appName}. Your teammates will see this address when they receive a recognition email.`],
        points: "", action: "Open email settings", path: "/admin/settings#gmail",
      };
  }
}

function escapeHtml(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderNotification(appName: string, notification: Notification) {
  const copy = copyFor(appName, notification);
  const origin = new URL(process.env.AUTH_URL || "https://yayup.app").origin;
  const url = new URL(copy.path, origin).href;
  const text = [copy.title, ...copy.paragraphs, copy.points, `${copy.action}: ${url}`].filter(Boolean).join("\n\n");
  const brand = escapeHtml(appName);
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${copy.subject}</title>
<style>@media(max-width:480px){.outer{padding:16px 8px!important}.inset{padding-left:22px!important;padding-right:22px!important}.headline{font-size:34px!important;line-height:37px!important}}</style></head>
<body style="margin:0;background-color:#f5f4f8;font-family:Arial,Helvetica,sans-serif;color:#20172c">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(copy.preview)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f5f4f8"><tr><td class="outer" align="center" style="padding:36px 12px">
<!--[if mso]><table role="presentation" width="576"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="max-width:576px;border:1px solid #e3dfea;border-radius:20px">
<tr><td class="inset" style="padding:24px 32px"><a href="${escapeHtml(origin)}" style="font-size:25px;font-weight:bold;color:#23172f;text-decoration:none"><img src="${escapeHtml(origin)}/brand/yayup-logo.png" width="119" height="26" alt="${brand}" style="display:block;width:119px;height:26px;border:0"></a></td></tr>
<tr><td class="inset" bgcolor="#281d40" style="padding:33px 32px 37px;background-color:#281d40;border-left:5px solid #977dff">
<p style="margin:0 0 13px;color:#dccbff;font-size:12px;line-height:16px;font-weight:bold;text-transform:uppercase;letter-spacing:1.4px">${copy.label}</p>
<h1 class="headline" style="margin:0;font-size:41px;line-height:45px;letter-spacing:-1.4px;font-weight:bold;color:#ffffff">${copy.title}</h1>
</td></tr>
<tr><td class="inset" style="padding:29px 32px 30px">
${copy.paragraphs.map(p => `<p style="margin:0 0 12px;color:#382e43;font-size:17px;line-height:26px">${escapeHtml(p)}</p>`).join("")}
${copy.points ? `<p style="margin:14px 0;color:#5233bc;font-size:18px;font-weight:bold">${escapeHtml(copy.points)} <span style="font-weight:normal;color:#594f63;font-size:15px">in your wallet</span></p>` : ""}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:20px"><tr><td bgcolor="#5b3ae4" style="border-radius:10px;mso-padding-alt:14px 20px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 20px;font-size:15px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:bold">${copy.action}</a></td></tr></table>
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  return { subject: copy.subject, text, html };
}
