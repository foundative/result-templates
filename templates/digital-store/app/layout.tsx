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

// The store name lives in the database so the owner can change it, but a link
// preview cannot wait for a query. Set these by hand to match.
export const metadata: Metadata = {
  title: "The shop",
  description: "Things worth paying for, delivered the second you buy them.",
  openGraph: {
    title: "The shop",
    description: "Things worth paying for, delivered the second you buy them.",
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
