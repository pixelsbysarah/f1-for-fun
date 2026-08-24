import type { Metadata } from "next";

import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "For Fun: An F1 Personal Prediction Tracker",
  description: "a non-serious prediction tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Fixed dark theme only — no light/dark toggle (CLAUDE.md).
    <html lang="en" data-theme="f1forfun" className={fontVariables}>
      <body className="track-gutters font-body text-off-white antialiased">
        {children}
      </body>
    </html>
  );
}
