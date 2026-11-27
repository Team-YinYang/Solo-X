import Link from "next/link";
import { WalletPanel } from "../../components/wallet-panel";

const modules = [
  { name: "Create currency", detail: "Configuration and issuance setup" },
  { name: "Manage reserves", detail: "Collateral and supply overview" },
  { name: "Mint & redeem", detail: "Wallet-authorized operations" },
  { name: "Convert", detail: "Compatible currency conversion" },
];

export default function WorkspacePage() {
  return (
    <main className="shell">
      <header className="header">
        <Link href="/" className="brand">
          <span className="symbol" aria-hidden="true">✳</span> Solo-X
        </Link>
        <span className="label">Devnet and local validator only</span>
      </header>
      <section className="workspace">
        <span className="eyebrow">Workspace preview</span>
        <h1>Manage your currencies.</h1>
        <p className="lede">Connect a test wallet to verify ownership. Protocol transactions remain disabled.</p>
        <WalletPanel />
        <div className="grid">
          {modules.map(({ name, detail }) => (
            <article className="module" key={name}>
              <span className="eyebrow">Planned</span>
              <h2>{name}</h2>
              <p>{detail}</p>
            </article>
          ))}
        </div>
        <Link className="back" href="/">← Back to overview</Link>
      </section>
    </main>
  );
}
