"use client";

import Script from "next/script";
import { useEffect } from "react";

const metrikaId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;

export function Analytics() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const values: Record<string, string> = {};
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
    ].forEach((key) => {
      const value = params.get(key);
      if (value) values[key] = value;
    });
    if (Object.keys(values).length)
      sessionStorage.setItem("klinika_utm", JSON.stringify(values));
  }, []);

  if (!metrikaId) return null;
  return (
    <Script id="yandex-metrika" strategy="afterInteractive">
      {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=${metrikaId}','ym');ym(${metrikaId},'init',{ssr:true,webvisor:true,clickmap:true,accurateTrackBounce:true,trackLinks:true});`}
    </Script>
  );
}

export function reachGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !metrikaId) return;
  const ym = (window as unknown as { ym?: (...args: unknown[]) => void }).ym;
  ym?.(Number(metrikaId), "reachGoal", goal, params);
}
