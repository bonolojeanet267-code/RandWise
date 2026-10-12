import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthGate from "@/components/AuthGate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RandWise",
  description: "Simple tools to help small businesses make every rand count.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#231934] text-white">
        <AuthGate>{children}</AuthGate>
        <footer className="border-t border-white/10 bg-[#231934] px-4 py-5 text-center text-xs text-white/65">
          © 2026 RandWise. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
