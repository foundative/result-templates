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

// The marketing page is shared before it is visited, so these two lines are the
// first impression. Change them before you change anything else.
export const metadata: Metadata = {
  title: "Ledgerly - the quiet way to track anything",
  description: "One list, shared with your team, that does not need a manual.",
  openGraph: {
    title: "Ledgerly - the quiet way to track anything",
    description: "One list, shared with your team, that does not need a manual.",
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
