import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PlugRight — Reuse before you buy",
  description: "Browser AI equipment intake, documented USB-C connection checks and PayPal sandbox checkout. No real payments.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
