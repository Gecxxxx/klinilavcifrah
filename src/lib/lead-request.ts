// Keep only a hash of form values and non-contact attribution in sessionStorage.
// The same request ID survives a lost HTTP reply and a page reload.
export type Attribution = {
  page: string;
  referrer: string;
  landingPage: string;
  utm: Record<string, string>;
  interest?: "crm_custom";
  product?: string;
  direction?: string;
  ctaPage?: string;
  ctaLocation?: string;
};
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Pending = { fingerprint: string; id: string; attribution: Attribution };
const key = "klinika_pending_lead_v1";
let memory: Pending | undefined;
const reported = new Set<string>();

export async function prepareLeadRequest(
  values: Record<string, unknown>,
  attribution: Attribution,
  storage?: StorageLike,
) {
  const canonical = JSON.stringify(
    Object.entries(values)
      .filter(([key]) => key !== "turnstileToken")
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  const fingerprint = Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical),
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  let pending = memory;
  try {
    const candidate = JSON.parse(
      storage?.getItem(key) || "null",
    ) as Pending | null;
    if (
      candidate &&
      typeof candidate.id === "string" &&
      /^[A-Za-z0-9_-]{20,80}$/.test(candidate.id) &&
      candidate.fingerprint === fingerprint &&
      candidate.attribution &&
      typeof candidate.attribution.page === "string" &&
      typeof candidate.attribution.referrer === "string" &&
      typeof candidate.attribution.landingPage === "string" &&
      candidate.attribution.utm &&
      typeof candidate.attribution.utm === "object"
    )
      pending = candidate;
  } catch {}
  if (!pending || pending.fingerprint !== fingerprint) {
    pending = { fingerprint, id: crypto.randomUUID(), attribution };
  }
  memory = pending;
  try {
    storage?.setItem(key, JSON.stringify(pending));
  } catch {}
  return { ...values, ...pending.attribution, requestId: pending.id };
}

export function acknowledgeLead(id: string, storage?: StorageLike) {
  memory = undefined;
  let first = !reported.has(id);
  try {
    first = first && storage?.getItem("klinika_saved_" + id) !== "1";
    storage?.setItem("klinika_saved_" + id, "1");
    storage?.removeItem(key);
  } catch {}
  reported.add(id);
  return first;
}
