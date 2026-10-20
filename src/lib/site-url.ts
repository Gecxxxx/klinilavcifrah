export const PRODUCTION_SITE_URL = "https://klinikavcifrah.ru";

/** A missing build variable must never publish localhost in SEO metadata. */
export function resolveSiteUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL,
  production = process.env.NODE_ENV === "production",
): string {
  const url = new URL(value?.trim() || PRODUCTION_SITE_URL);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.pathname !== "/" || url.search || url.hash
  ) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without a path, credentials, query or fragment.");
  }
  const hostname = url.hostname.toLowerCase();
  if (production && (
    url.protocol !== "https:" || hostname === "localhost" ||
    hostname.endsWith(".localhost") || hostname === "0.0.0.0" ||
    hostname.startsWith("127.") || hostname === "[::1]"
  )) {
    throw new Error("Production NEXT_PUBLIC_SITE_URL must use HTTPS and a public hostname.");
  }
  // The production canonical host is the apex domain, including on www requests.
  if (hostname === "www.klinikavcifrah.ru") url.hostname = "klinikavcifrah.ru";
  return url.origin;
}

export const SITE_URL = resolveSiteUrl();
