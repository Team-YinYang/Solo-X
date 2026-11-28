import type { ReactNode } from "react";
import { BulkTransferPanel } from "../../components/bulk-transfer-panel";
import { CurrencyDiscoveryPanel } from "../../components/currency-discovery-panel";
import { HistoryReconciliationPanel } from "../../components/history-reconciliation-panel";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <>
    {children}
    <section className="shell advanced-tools">
      <div className="section-heading">
        <span className="eyebrow"><i aria-hidden="true" /> Operations</span>
        <h2>Discover, distribute, reconcile.</h2>
        <p>Advanced utilities for test-network currency operations.</p>
      </div>
      <div className="protocol-grid">
        <BulkTransferPanel />
        <CurrencyDiscoveryPanel />
        <HistoryReconciliationPanel />
      </div>
    </section>
  </>;
}
