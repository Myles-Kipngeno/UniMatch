import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-outfit",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-visual",
  viewportFit: "cover",
  themeColor: "#0f0e17",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://uni-match-one.vercel.app"),
  title: "UniMatch — Campus Dating for University Students",
  description: "Meet real, verified students from your campus — for love, friendship & study dates. Free, safe and made for campus life.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" }
    ],
    apple: [
      { url: "/Unimatch_icon.png" }
    ]
  },
  openGraph: {
    title: "UniMatch — Campus Dating for University Students",
    description: "Meet real, verified students from your campus — for love, friendship & study dates. Free, safe and made for campus life.",
    url: "https://uni-match-one.vercel.app",
    siteName: "UniMatch",
    images: [
      {
        url: "https://uni-match-one.vercel.app/og-image.jpg",
        secureUrl: "https://uni-match-one.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        type: "image/jpeg",
        alt: "UniMatch — Campus Dating for University Students"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "UniMatch — Campus Dating for University Students",
    description: "Meet real, verified students from your campus — for love, friendship & study dates.",
    images: ["https://uni-match-one.vercel.app/og-image.jpg"]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UniMatch"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`} suppressHydrationWarning>
      <body className={`${outfit.className} min-h-full flex flex-col`} suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
