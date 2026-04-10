import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trade3 Proof Camera",
  description: "Trade3 mobile-first provenance capture and verification."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
