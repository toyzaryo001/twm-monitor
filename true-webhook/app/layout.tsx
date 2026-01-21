import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TWM Monitor",
  description: "TrueWallet Monitoring System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
