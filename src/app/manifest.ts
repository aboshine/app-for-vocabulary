import type { MetadataRoute } from "next";

/** Lets the phone "Add to Home Screen" and open the site like an app (no address bar). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Korean Vocab",
    short_name: "Korean",
    description: "Korean words, reading and grammar with a personal AI teacher",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ee",
    theme_color: "#f6f3ee",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
