export function validSlackWebhook(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "hooks.slack.com" && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname);
  } catch { return false; }
}
export function weeklyKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  const local = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}
export function cronAuthorized(header: string | null, secret: string | undefined): boolean {
  return !!secret && secret.length >= 32 && header === `Bearer ${secret}`;
}
export function slackPayload(text: string) {
  const safe = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").slice(0, 11000);
  return { text: `Fark AI Marketing · Performans raporu\n\n${safe}`, mrkdwn: false, unfurl_links: false, unfurl_media: false };
}
