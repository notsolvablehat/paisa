/** Public site facts shared by metadata, sitemap, robots, llms.txt and the landing page. */

/** Canonical origin. Set NEXT_PUBLIC_SITE_URL in production (e.g. https://paisa.example.com). */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.BETTER_AUTH_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

export const SITE_NAME = "paisa";
export const TAGLINE = "Know what's safe to spend today";
export const DESCRIPTION =
  "paisa is a free personal finance app for India that turns your monthly budget into one number: what's safe to spend today, after bills due and money set aside for goals. Track spends, income, bills and savings goals in rupees.";

/** Where signed-in people land (the dashboard). `/` is the public landing page. */
export const APP_HOME = "/overview";
