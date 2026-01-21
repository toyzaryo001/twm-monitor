import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TWM Monitor",
  description: "Frontend for TWM Monitor",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
