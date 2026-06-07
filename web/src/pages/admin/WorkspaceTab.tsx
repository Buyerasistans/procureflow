import { useEffect, useState } from "react";
import { getUserScopeType } from "../../auth/permissions";
import QuoteList from "../../components/QuoteList";
import { useAuth } from "../../hooks/useAuth";
import { getFinanceMismatches } from "../../services/admin.service";
import {
  getChannelCommissionReport,
  getChannelConversionMetrics,
  getChannelGamification,
  getChannelProfileSummary,
  type ChannelCommissionReport,
  type ChannelConversionMetrics,
  type ChannelGamification,
  type ChannelProfileSummary,
} from "../../services/profile.service";
import "./WorkspaceTab.css";

interface MismatchItem {
  supplier_id: number;
  supplier_name: string;
  alerts: string[];
  totals: { contract_total: number; invoice_total: number; payment_total: number };
}

export default function WorkspaceTab() {
  const { user } = useAuth();
  const [mismatches, setMismatches]           = useState<MismatchItem[]>([]);
  const [channelSummary, setChannelSummary]   = useState<ChannelProfileSummary | null>(null);
  const [channelConversion, setChannelConversion] = useState<ChannelConversionMetrics | null>(null);
  const [channelCommission, setChannelCommission] = useState<ChannelCommissionReport | null>(null);
  const [channelGamification, setChannelGamification] = useState<ChannelGamification | null>(null);

  const isChannelWorkspace = getUserScopeType(user) === "channel";

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "super_admin") {
      getFinanceMismatches(5)
        .then((data) => setMismatches(data.items as MismatchItem[]))
        .catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    if (!isChannelWorkspace) return;
    let mounted = true;
    Promise.all([
      getChannelProfileSummary().catch(() => null),
      getChannelConversionMetrics("30d").catch(() => null),
      getChannelCommissionReport("30d").catch(() => null),
      getChannelGamification().catch(() => null),
    ]).then(([summary, conversion, commission, gamification]) => {
      if (!mounted) return;
      setChannelSummary(summary);
      setChannelConversion(conversion);
      setChannelCommission(commission);
      setChannelGamification(gamification);
    });
    return () => { mounted = false; };
  }, [isChannelWorkspace]);

  const channelLoading =
    isChannelWorkspace &&
    channelSummary === null &&
    channelConversion === null &&
    channelCommission === null &&
    channelGamification === null;

  return (
    <div className="workspace-tab">

      {mismatches.length > 0 && (
        <section className="workspace-tab__section">
          <h3 className="workspace-tab__section-title">Finans Uyarıları</h3>
          <div className="workspace-tab__mismatch-list">
            {mismatches.map((m) => (
              <article key={m.supplier_id} className="workspace-tab__mismatch-card">
                <div className="workspace-tab__mismatch-main">
                  <div className="workspace-tab__mismatch-name">{m.supplier_name}</div>
                  <div className="workspace-tab__mismatch-alerts">{m.alerts.join(" • ")}</div>
                </div>
                <div className="workspace-tab__mismatch-totals">
                  <div>Sözleşme: {m.totals.contract_total.toLocaleString("tr-TR")}</div>
                  <div>Fatura: {m.totals.invoice_total.toLocaleString("tr-TR")}</div>
                  <div>Ödeme: {m.totals.payment_total.toLocaleString("tr-TR")}</div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {isChannelWorkspace && (
        <section className="workspace-tab__channel">
          <div className="workspace-tab__metrics-grid">
            <div className="workspace-tab__metric-card">
              <div className="workspace-tab__metric-label">Ekip (Aktif / Toplam)</div>
              <div className="workspace-tab__metric-value">
                {channelLoading
                  ? "..."
                  : `${channelSummary?.active_team_size ?? 0} / ${channelSummary?.total_team_size ?? 0}`}
              </div>
            </div>
            <div className="workspace-tab__metric-card">
              <div className="workspace-tab__metric-label">30 Gün Yeni Müşteri</div>
              <div className="workspace-tab__metric-value">
                {channelLoading ? "..." : channelSummary?.last_30d_new_customers ?? 0}
              </div>
            </div>
            <div className="workspace-tab__metric-card">
              <div className="workspace-tab__metric-label">Dönüşüm (Tıklama / Kayıt)</div>
              <div className="workspace-tab__metric-value">
                {channelLoading ? "..." : `${channelConversion?.clicks ?? 0} / ${channelConversion?.signups ?? 0}`}
              </div>
            </div>
            <div className="workspace-tab__metric-card">
              <div className="workspace-tab__metric-label">Aylık Net Komisyon</div>
              <div className="workspace-tab__metric-value">
                {channelLoading
                  ? "..."
                  : `${Number(
                      channelSummary?.commission_net_current_month ?? channelCommission?.totals?.net ?? 0,
                    ).toLocaleString("tr-TR")} TL`}
              </div>
            </div>
            <div className="workspace-tab__metric-card">
              <div className="workspace-tab__metric-label">Seviye</div>
              <div className="workspace-tab__metric-value">
                {channelLoading ? "..." : channelGamification?.level_code ?? "L0"}
              </div>
            </div>
          </div>
        </section>
      )}

      {!isChannelWorkspace && <QuoteList showHero={false} />}
    </div>
  );
}
