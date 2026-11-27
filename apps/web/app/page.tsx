import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell landing-shell">
      <header className="header">
        <Link href="/" className="brand" aria-label="Solo-X home">
          <Image className="brand-logo" src="/solo-x-logo.png" alt="" width={44} height={44} priority />
          <span>Solo-X</span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link href="/workspace">Workspace</Link>
          <a href="#how-it-works">How it works</a>
          <a href="https://github.com/Team-YinYang/Solo-X" target="_blank" rel="noreferrer">Documentation</a>
        </nav>
        <Link className="header-action" href="/workspace">Enter workspace <span aria-hidden="true">↗</span></Link>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i aria-hidden="true" /> Stablecoin infrastructure on Solana</span>
          <h1>Create stablecoins, <span>not code.</span></h1>
          <p className="lede">
            Launch your own collateral-backed currency. Create, issue, exchange,
            and redeem from one secure workspace—no smart-contract code required.
          </p>
          <div className="hero-actions">
            <Link className="action" href="/workspace">Enter workspace <span aria-hidden="true">↗</span></Link>
            <a className="text-action" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <div className="trust-row" aria-label="Protocol features">
            <span><b aria-hidden="true">◆</b> Built on Solana</span>
            <span><b aria-hidden="true">●</b> USDC-backed</span>
            <span><b aria-hidden="true">⌁</b> Permissionless</span>
          </div>
        </div>

        <div className="hero-stage" aria-label="One-to-one collateral illustration">
          <div className="stage-orbit orbit-one" aria-hidden="true" />
          <div className="stage-orbit orbit-two" aria-hidden="true" />
          <article className="asset-card usdc-card">
            <div className="asset-icon mint">U</div>
            <div><span>Deposit collateral</span><strong>USDC</strong></div>
            <b>100</b>
          </article>
          <div className="conversion-node" aria-hidden="true"><span>1:1</span></div>
          <article className="asset-card currency-card">
            <div className="asset-icon violet">Y</div>
            <div><span>Mint matching units</span><strong>Your currency</strong></div>
            <b>100</b>
          </article>
          <div className="reserve-pill"><span>Reserve ratio</span><strong>100%</strong></div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div>
          <span className="eyebrow"><i aria-hidden="true" /> Simple by design</span>
          <h2>From collateral to currency in three moves.</h2>
        </div>
        <ol className="steps">
          <li><span>01</span><strong>Configure</strong><p>Choose the currency identity and test collateral.</p></li>
          <li><span>02</span><strong>Fund &amp; mint</strong><p>Deposit USDC and issue matching units atomically.</p></li>
          <li><span>03</span><strong>Move value</strong><p>Transfer, convert, inspect reserves, or redeem.</p></li>
        </ol>
      </section>

      <footer className="footer">
        <span>Built by Team YinYang · Powered by Solana</span>
        <span>Foundation preview · Not audited · No real funds</span>
      </footer>
    </main>
  );
}
