import { HistoryReconciliationPanel } from "../../components/history-reconciliation-panel";
import { CurrencyDiscoveryPanel } from "../../components/currency-discovery-panel";
import type { ReactNode } from "react";
import { BulkTransferPanel } from "../../components/bulk-transfer-panel";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <>{children}<section className="shell"><BulkTransferPanel /><CurrencyDiscoveryPanel /><HistoryReconciliationPanel /></section></>;
}
