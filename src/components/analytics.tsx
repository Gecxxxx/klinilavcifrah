"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  attributionTracker,
  browserAttribution,
  safePage,
} from "@/lib/lead-attribution";
import { contactChannel, metrikaId, reachGoal, trackPage } from "@/lib/analytics";
export { reachGoal } from "@/lib/analytics";

export function Analytics() {
  const pathname = usePathname();
  const search = useSearchParams();
  const last = useRef("");
  useEffect(() => {
    browserAttribution();
    const route = pathname + "?" + search.toString();
    if (last.current !== route) {
      last.current = route;
      trackPage(safePage(pathname));
    }
  }, [pathname, search]);
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const contact = (event.target as Element | null)?.closest?.(
        "a[href], summary[data-contact-channel]",
      );
      const channel =
        contact?.getAttribute("data-contact-channel") === "max"
          ? "max"
          : contactChannel(contact?.getAttribute("href") || "");
      if (channel) {
        reachGoal("contact_click", {
          page: safePage(window.location.pathname),
          channel,
        });
      }
      const link = (event.target as Element | null)?.closest?.(
        "a[data-lead-cta]",
      ) as HTMLAnchorElement | null;
      if (!link) return;
      let storage: Storage | undefined;
      try {
        storage = window.sessionStorage;
      } catch {}
      const source = attributionTracker.selectCta(
        new URL(window.location.href),
        link.dataset.leadCta || "",
        document.referrer,
        storage,
        link.dataset.leadDirection,
      );
      reachGoal("cta_click", {
        page: source.page,
        location: source.ctaLocation,
        direction: source.direction,
        product: source.product,
      });
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);
  if (!metrikaId) return null;
  return (
    <Script
      id="yandex-metrika"
      src="https://mc.yandex.ru/metrika/tag.js"
      strategy="afterInteractive"
    />
  );
}
