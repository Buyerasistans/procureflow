import { useCallback, useEffect, useState } from "react";
import "./commission-admin-tab.css";
import {
  getAdminCommissionLedger,
  getAdminCommissionDashboard,
  type AdminLedgerList,
  type AdminCommissionDashboard,
} from "../../services/profile.service";
import { CommissionApprovalPanel } from "../../components/channel/CommissionApprovalPanel";
import { CommissionDashboardPanel } from "../../components/channel/CommissionDashboardPanel";
import { PageHeader, StatCard } from "./AdminTabContent";

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

  const activePartners = dashboard?.org_breakdown?.length ?? 0;
  const pendingCount = ledger.items.filter((i) => i.status === "pending").length;

  const subText = dashboardLoading
    ? "Yükleniyor…"
    : `${activePartners} aktif iş ortağı · ${pendingCount} ödeme bekliyor`;

  return (
    <div className="commission-admin-tab">
      <PageHeader
        eyebrow="Ticari"
        title="Komisyon Yönetimi"
        sub={subText}
      />

      <div className="kpi-grid kpi-grid--4">
        <StatCard
          label="Ödenecek (bu ay)"
          value={dashboard?.total_pending ?? 0}
          currency="₺"
          accent="gold"
          sub={`${pendingCount} ödeme · vade ayın 1'i`}
        />
        <StatCard
          label="Son 30 günde ödenen"
          value={dashboard?.total_paid ?? 0}
          currency="₺"
          accent="green"
        />
        <StatCard
          label="Aktif iş ortağı"
          value={activePartners}
          accent="blue"
          sub={`${ledger.items.length} toplam kayıt`}
        />
        <StatCard
          label="Bekleyen onay"
          value={pendingCount}
          accent={pendingCount > 0 ? "warn" : "default"}
          sub="KYC veya doğrulama aşamasında"
        />
      </div>

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
