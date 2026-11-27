import type { Metadata } from "next";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletProviders } from "../components/wallet-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solo-X | Programmable stablecoin infrastructure",
  description: "Wallet-first infrastructure for collateral-backed stablecoins on Solana.",
  icons: {
    icon: "/solo-x-logo.png",
    apple: "/solo-x-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><WalletProviders>{children}</WalletProviders></body>
    </html>
  );
}
