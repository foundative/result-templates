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

// This page is shared as a link before it is ever visited, so these two lines
// are the first impression. The profile itself is read from the database at
// runtime, but a link preview cannot wait for that, so set them by hand.
export const metadata: Metadata = {
  title: "My links",
  description: "Everything I make, in one place.",
  openGraph: {
    title: "My links",
    description: "Everything I make, in one place.",
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
