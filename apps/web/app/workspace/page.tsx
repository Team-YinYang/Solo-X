import Image from "next/image";
import Link from "next/link";
import { ConversionTransferPanel } from "../../components/conversion-transfer-panel";
import { CreateCurrencyPanel } from "../../components/create-currency-panel";
import { CurrencyMetadataPanel } from "../../components/currency-metadata-panel";
import { MintRedeemPanel } from "../../components/mint-redeem-panel";
import { OrdinaryTokenPanel } from "../../components/ordinary-token-panel";
import { ReserveDashboard } from "../../components/reserve-dashboard";
import { WalletPanel } from "../../components/wallet-panel";

const tools = [
  { href: "#create-tool", number: "01", title: "Create currency", detail: "Launch a USDC-backed stablecoin.", label: "Currency symbol", value: "CAMP", accent: "USDC collateral", featured: true },
  { href: "#exchange-tool", number: "02", title: "Exchange", detail: "Convert compatible currencies.", label: "You receive", value: "100", accent: "1:1 conversion" },
  { href: "#reserve-tool", number: "03", title: "My currencies", detail: "Inspect supply and reserve health.", label: "Reserve ratio", value: "100%", accent: "Fully backed" },
  { href: "#mint-tool", number: "04", title: "Mint & send", detail: "Issue and distribute test units.", label: "Deposit USDC", value: "250", accent: "250 units" },
  { href: "#mint-tool", number: "05", title: "Redeem", detail: "Burn tokens to unlock USDC.", label: "You receive", value: "100", accent: "USDC" },
];

export default function WorkspacePage() {
  return (
    <main className="shell workspace-shell">
      <header className="header">
        <Link href="/" className="brand" aria-label="Solo-X home">
          <Image className="brand-logo" src="/solo-x-logo.png" alt="" width={44} height={44} priority />
          <span>Solo-X</span>
        </Link>
        <nav className="site-nav" aria-label="Workspace navigation">
          <Link className="active" href="/workspace">Workspace</Link>
          <a href="https://github.com/Team-YinYang/Solo-X" target="_blank" rel="noreferrer">Documentation</a>
        </nav>
        <a className="header-action" href="#wallet">Connect wallet</a>
      </header>

      <section className="workspace-intro">
        <span className="eyebrow"><i aria-hidden="true" /> Devnet workspace</span>
        <h1>Your currency. <span>Your rules.</span></h1>
        <p className="lede">Choose a tool to get started. Connect a test wallet to verify ownership. Mint and redeem using test funds only.</p>
      </section>

      <div id="wallet"><WalletPanel /></div>

      <section className="tool-grid" aria-label="Solo-X tools">
        {tools.map((tool) => (
          <a className={`tool-card${tool.featured ? " featured" : ""}`} href={tool.href} key={tool.number}>
            <span className="tool-number">{tool.number}</span>
            <div className="tool-copy"><h2>{tool.title}</h2><p>{tool.detail}</p><strong>Open tool <span aria-hidden="true">↗</span></strong></div>
            <div className="tool-preview"><span>{tool.label}</span><b>{tool.value}</b><em>{tool.accent}</em></div>
          </a>
        ))}
      </section>

      <section className="live-tools">
        <div className="section-heading">
          <span className="eyebrow"><i aria-hidden="true" /> Live protocol tools</span>
          <h2>Build and manage your currency.</h2>
          <p>Every action is prepared for review before your wallet signs it.</p>
        </div>
        <div className="protocol-grid">
          <div id="create-tool"><CreateCurrencyPanel /></div>
          <div id="reserve-tool"><ReserveDashboard /></div>
          <div id="mint-tool"><MintRedeemPanel /></div>
          <div id="exchange-tool"><ConversionTransferPanel /></div>
          <CurrencyMetadataPanel />
          <OrdinaryTokenPanel />
        </div>
      </section>

      <footer className="footer">
        <Link className="back" href="/">← Back to overview</Link>
        <span>Devnet and local validator only · No real funds</span>
      </footer>
    </main>
  );
}
