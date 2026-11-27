import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solo-X | Programmable stablecoin infrastructure",
  description: "Wallet-first infrastructure for collateral-backed stablecoins on Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
