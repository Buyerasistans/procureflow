import React, { useCallback, useEffect, useState } from "react";
import {
  getAdminCommissionLedger,
  getAdminCommissionDashboard,
  type AdminLedgerList,
  type AdminCommissionDashboard,
} from "../../services/profile.service";
import { CommissionApprovalPanel } from "../../components/channel/CommissionApprovalPanel";
import { CommissionDashboardPanel } from "../../components/channel/CommissionDashboardPanel";

export function CommissionAdminTab() {
  const [ledger, setLedger] = useState<AdminLedgerList>({ total: 0, items: [] });
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [dashboard, setDashboard] = useState<AdminCommissionDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const loadLedger = useCallback(async () => {
    setLedgerLoading(true);
    try {
      const data = await getAdminCommissionLedger({ limit: 200 });
      setLedger(data);
    } catch {
      // sessiz hata
    } finally {
      setLedgerLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const data = await getAdminCommissionDashboard();
      setDashboard(data);
    } catch {
      // sessiz hata
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLedger();
    void loadDashboard();
  }, [loadLedger, loadDashboard]);

  function handleRefresh() {
    void loadLedger();
    void loadDashboard();
  }

  return (
    <div style={{ padding: "20px 0" }}>
      <CommissionDashboardPanel
        data={dashboard}
        loading={dashboardLoading}
        onRefresh={handleRefresh}
      />
      <CommissionApprovalPanel
        items={ledger.items}
        loading={ledgerLoading}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
