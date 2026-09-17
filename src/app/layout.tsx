import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "LuxuryPad — Luxury, launched onchain",
    template: "%s · LuxuryPad",
  },
  description:
    "Discover and launch tokens around the companies and narratives defining global luxury markets. Built on Pons V2, Robinhood Chain.",
  openGraph: {
    title: "LuxuryPad — Luxury, launched onchain",
    description:
      "Discover and launch tokens around the companies and narratives defining global luxury markets.",
    url: appUrl,
    siteName: "LuxuryPad",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "LuxuryPad — Luxury, launched onchain" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} antialiased`}>
        <Providers>
          <div className="flex min-h-dvh flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
