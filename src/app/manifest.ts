import type { MetadataRoute } from "next";

/** "Add to Home Screen" opens paisa full-screen, like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "paisa",
    short_name: "paisa",
    description: "Know what's safe to spend today.",
    start_url: "/overview",
    display: "standalone",
    background_color: "#f6f6f5",
    theme_color: "#111210",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
