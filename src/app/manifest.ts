import type { MetadataRoute } from "next";
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Клиника в цифрах",
    short_name: "Клиника в цифрах",
    description: "Внешний коммерческий контур для частных клиник",
    start_url: "/",
    display: "standalone",
    background_color: "#050910",
    theme_color: "#050910",
    lang: "ru",
  };
}
