import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./bantrboks-app-overrides.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bantrboks.com"),
  title: "Bantrboks | Drop takes. Win likes. Climb the board.",
  description:
    "Bantrboks is the Springboks vs All Blacks bantr room. Drop takes, win likes, and climb the board.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand/bantrbox-tab-icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Bantrboks",
    description: "Drop takes. Win likes. Climb the board.",
    images: ["/brand/bantrboks-approved-website-landing.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
