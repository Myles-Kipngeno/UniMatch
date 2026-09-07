import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "UniMatch",
  description: "University Match and Dating Web App",
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
    title: "UniMatch",
    description: "University Match and Dating Web App for Students",
    url: "https://uni-match-one.vercel.app",
    siteName: "UniMatch",
    images: [
      {
        url: "/Unimatch_icon.png",
        width: 1200,
        height: 630,
        alt: "UniMatch Logo"
      }
    ],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "UniMatch",
    description: "University Match and Dating Web App for Students",
    images: ["/Unimatch_icon.png"]
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
      </body>
    </html>
  );
}
