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

// A directory lives or dies on search traffic, so these two lines matter more
// here than in any other template. Say what is IN the directory, not that it is
// a directory.
export const metadata: Metadata = {
  title: "The directory",
  description: "Everything worth knowing about, in one list.",
  openGraph: {
    title: "The directory",
    description: "Everything worth knowing about, in one list.",
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
