import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A launch page is shared before it is visited, so the link preview IS the
// first impression. Change these two lines before you change anything else.
export const metadata: Metadata = {
  title: "Northbound - joining soon",
  description: "Be first in line when we open the doors.",
  openGraph: {
    title: "Northbound - joining soon",
    description: "Be first in line when we open the doors.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      lang="en"
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
