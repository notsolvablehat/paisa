import type { Metadata, Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import "remixicon/fonts/remixicon.css";
import "@/components/arc/foundation.css";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "paisa",
  description: "Know what's safe to spend today.",
  appleWebApp: { capable: true, title: "paisa", statusBarStyle: "default" },
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
