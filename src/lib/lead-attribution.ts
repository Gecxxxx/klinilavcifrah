import type { Attribution } from "./lead-request";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type Visit = Pick<Attribution, "landingPage" | "referrer" | "utm">;
type Intent = Pick<
  Attribution,
  "ctaPage" | "ctaLocation" | "direction" | "interest"
>;
const visitKey = "klinika_visit_v1";
const intentKey = "klinika_cta_v1";
const directions = new Set(["general", "marketing", "digital", "commercial"]);
function safeDirection(value: unknown) {
  return typeof value === "string" && directions.has(value) ? value : undefined;
}
const paths = new Set([
  "/",
  "/kontakty",
  "/kak-rabotaem",
  "/kejsy-i-razbory",
  "/dlya-klinik",
  "/marketing-i-privlechenie",
  "/sajt-crm-analitika",
  "/kommercheskaya-sistema",
  "/soglasheniya",
]);
export const ctaLocations = new Set([
  "hero",
  "header",
  "mobile_menu",
  "footer",
  "team",
  "final",
  "service_hero",
  "service_footer",
  "service_inline",
  "home_diagnostic",
  "work_start",
  "methodology",
  "page_hero",
  "not_found",
  "crm_custom",
  "service_catalog",
]);
export function safePage(path: string) {
  return paths.has(path.replace(/\/$/, "") || "/")
    ? path.replace(/\/$/, "") || "/"
    : "/other";
}
function direction(path: string) {
  return (
    (
      {
        "/marketing-i-privlechenie": "marketing",
        "/sajt-crm-analitika": "digital",
        "/kommercheskaya-sistema": "commercial",
      } as Record<string, string>
    )[path] || "general"
  );
}
function cleanUtm(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          /^utm_(source|medium|campaign|term|content)$/.test(key) &&
          typeof item === "string",
      )
      .map(([key, item]) => [
        key,
        String(item).replace(/\x00/g, "").slice(0, 200),
      ]),
  );
}
function cleanReferrer(value: string, origin: string) {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && url.origin !== origin
      ? (url.origin + url.pathname).slice(0, 500)
      : "";
  } catch {
    return "";
  }
}
function read(storage: StorageLike | undefined, key: string) {
  try {
    return JSON.parse(storage?.getItem(key) || "null");
  } catch {
    return null;
  }
}
function write(storage: StorageLike | undefined, key: string, value: unknown) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {}
}

export class AttributionTracker {
  private visit?: Visit;
  private intent?: Intent;
  capture(url: URL, referrer: string, storage?: StorageLike): Attribution {
    // First touch stays paired with its landing page and original campaign.
    if (!this.visit) {
      const saved = read(storage, visitKey);
      if (
        saved &&
        typeof saved.landingPage === "string" &&
        typeof saved.referrer === "string"
      )
        this.visit = {
          landingPage: safePage(saved.landingPage),
          referrer: cleanReferrer(saved.referrer, url.origin),
          utm: cleanUtm(saved.utm),
        };
      else
        this.visit = {
          landingPage: safePage(url.pathname),
          referrer: cleanReferrer(referrer, url.origin),
          utm: cleanUtm(Object.fromEntries(url.searchParams)),
        };
      write(storage, visitKey, this.visit);
    }
    if (!this.intent) {
      const saved = read(storage, intentKey);
      if (
        saved &&
        ctaLocations.has(saved.ctaLocation) &&
        typeof saved.ctaPage === "string"
      )
        this.intent = {
          interest:
            saved.ctaLocation === "crm_custom" ? "crm_custom" : undefined,
          ctaLocation: saved.ctaLocation,
          ctaPage: safePage(saved.ctaPage),
          direction:
            safeDirection(saved.direction) || direction(safePage(saved.ctaPage)),
        };
    }
    const page = safePage(url.pathname);
    const queryDirection =
      page === "/kontakty"
        ? safeDirection(url.searchParams.get("direction"))
        : undefined;
    const interest =
      url.searchParams.get("interest") === "crm_custom"
        ? "crm_custom"
        : queryDirection
          ? undefined
          : this.intent?.interest;
    return {
      ...this.visit,
      page,
      ...(interest ? { interest } : {}),
      product: "preliminary_review",
      direction: interest
        ? "digital"
        : queryDirection ||
          (direction(page) !== "general"
            ? direction(page)
            : this.intent?.direction || "general"),
      ctaLocation: this.intent?.ctaLocation || "direct",
      ctaPage: this.intent?.ctaPage || page,
    };
  }
  selectCta(
    url: URL,
    location: string,
    referrer: string,
    storage?: StorageLike,
    selectedDirection?: string,
  ) {
    this.capture(url, referrer, storage);
    if (ctaLocations.has(location)) {
      const page = safePage(url.pathname);
      this.intent = {
        interest: location === "crm_custom" ? "crm_custom" : undefined,
        ctaPage: page,
        ctaLocation: location,
        direction: safeDirection(selectedDirection) || direction(page),
      };
      write(storage, intentKey, this.intent);
    }
    return this.capture(url, referrer, storage);
  }
}
export const attributionTracker = new AttributionTracker();
export function browserAttribution() {
  let storage: Storage | undefined;
  try {
    storage = window.sessionStorage;
  } catch {}
  return attributionTracker.capture(
    new URL(window.location.href),
    document.referrer,
    storage,
  );
}
