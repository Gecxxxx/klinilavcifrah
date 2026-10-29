// Analytics failures must never change the outcome of saving a lead.
const rawId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID || "";
export const metrikaId = /^[1-9]\d{0,11}$/.test(rawId)
  ? Number(rawId)
  : undefined;
type Ym = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
let initialized = false;
const goals = new Set([
  "cta_click",
  "form_start",
  "form_submit",
  "form_error",
  "lead_saved",
  "form_success",
  "funnel_stage_open",
  "faq_open",
  "contact_click",
]);
const keys = new Set([
  "page",
  "location",
  "direction",
  "product",
  "reason",
  "fields",
  "stage",
  "question",
  "channel",
]);
export function contactChannel(href: string) {
  try {
    const url = new URL(href);
    if (url.protocol === "tel:") return "phone";
    if (url.protocol === "mailto:") return "email";
    if (url.protocol !== "https:") return undefined;
    if (url.hostname === "t.me") return "telegram";
    if (url.hostname === "wa.me") return "whatsapp";
  } catch {}
  return undefined;
}
function counter() {
  const target = window as unknown as { ym?: Ym };
  if (!target.ym) {
    const queue: Ym = (...args) => {
      (queue.a ||= []).push(args);
    };
    queue.l = Date.now();
    target.ym = queue;
  }
  if (!initialized) {
    target.ym(metrikaId, "init", {
      defer: true,
      webvisor: false,
      clickmap: true,
      trackLinks: false,
      accurateTrackBounce: true,
    });
    initialized = true;
  }
  return target.ym;
}
export function trackPage(path: string) {
  if (typeof window === "undefined" || !metrikaId) return;
  try {
    counter()(metrikaId, "hit", window.location.origin + path);
  } catch {}
}
export function reachGoal(goal: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !goals.has(goal)) return;
  const safe = Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) =>
        keys.has(key) && typeof value === "string" && value.length <= 160,
    ),
  );
  try {
    window.dispatchEvent(
      new CustomEvent("kvc:goal", { detail: { goal, params: safe } }),
    );
  } catch {}
  if (!metrikaId) return;
  try {
    counter()(metrikaId, "reachGoal", goal, safe);
  } catch {}
}
