import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import "remixicon/fonts/remixicon.css";
import "@/components/arc/foundation.css";
import "./globals.css";
import { Providers } from "@/components/providers";
import { DESCRIPTION, SITE_NAME, SITE_URL, TAGLINE } from "@/lib/site";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: ${TAGLINE.toLowerCase()}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "budget app India",
    "safe to spend",
    "daily budget",
    "expense tracker",
    "personal finance India",
    "bill reminders",
    "savings goals",
    "money manager rupees",
  ],
  category: "finance",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    title: `${SITE_NAME}: ${TAGLINE.toLowerCase()}`,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: ${TAGLINE.toLowerCase()}`,
    description: DESCRIPTION,
  },
  // Google Search Console: set GOOGLE_SITE_VERIFICATION to the token from the "HTML tag" method.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

/** Phone browser chrome matches the page background (light / dark). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f5" },
    { media: "(prefers-color-scheme: dark)", color: "#111113" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en-IN"
      className={`${inter.variable} ${geist.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
