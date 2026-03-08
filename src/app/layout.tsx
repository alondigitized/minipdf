import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MiniPDF — Secure PDF Editor",
  description:
    "Edit PDFs securely in your browser. No uploads, no servers — your files never leave your device.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
