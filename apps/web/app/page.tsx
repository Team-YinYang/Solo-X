import Link from "next/link";

export default function HomePage() {
  return (
    <main className="shell">
      <header className="header">
        <Link href="/" className="brand" aria-label="Solo-X home">
          <span className="symbol" aria-hidden="true">✳</span> Solo-X
        </Link>
        <span className="label">Solana · Devnet MVP</span>
      </header>
      <section className="hero">
        <span className="eyebrow">Team YinYang / Solo-X</span>
        <h1>Infrastructure for programmable stablecoins.</h1>
        <p className="lede">
          Wallet-first infrastructure for creating and managing collateral-backed
          currencies on Solana. Development uses test collateral only.
        </p>
        <Link className="action" href="/workspace">
          Enter workspace <span aria-hidden="true">↗</span>
        </Link>
        <p className="note">Foundation preview · Not audited · No real funds</p>
      </section>
      <footer className="footer">
        <span>SOLO-X / 2026</span>
        <span>Building transparent settlement infrastructure.</span>
      </footer>
    </main>
  );
}
