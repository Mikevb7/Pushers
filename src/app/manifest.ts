import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pushers",
    short_name: "Pushers",
    description: "Schema, progressie en streaks voor de crew.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f1ef",
    theme_color: "#f5f1ef",
    lang: "nl",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
