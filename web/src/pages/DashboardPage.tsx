// FILE: web/src/pages/DashboardPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildWorkspacePanelTheme, mergeWorkspacePanelConfig, resolveWorkspacePanelProfile } from "../admin/workspace-panels";
import { getUserDisplayRoleLabel, getRoleIcon, getUserScopeType, normalizedBusinessRole } from "../auth/permissions";
import PageLoader from "../components/PageLoader";
import QuoteList from "../components/QuoteList";
import WorkspaceHeroCard from "../components/WorkspaceHeroCard";
import { useAuth } from "../hooks/useAuth";
import {
  getFinanceMismatches,
  getWorkspacePanelConfig,
  type WorkspacePanelConfig,
} from "../services/admin.service";
import {
  getChannelCommissionReport,
  getChannelConversionMetrics,
  getChannelGamification,
  getChannelProfileSummary,
  type ChannelCommissionReport,
  type ChannelConversionMetrics,
  type ChannelGamification,
  type ChannelProfileSummary,
} from "../services/profile.service";
import "./DashboardPage.css";

interface MismatchItem {
  supplier_id: number;
  supplier_name: string;
  alerts: string[];
  totals: {
    contract_total: number;
    invoice_total: number;
    payment_total: number;
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [mismatches, setMismatches] = useState<MismatchItem[]>([]);
  const [workspacePanelConfig, setWorkspacePanelConfig] = useState<WorkspacePanelConfig | null>(null);
  const [channelSummary, setChannelSummary] = useState<ChannelProfileSummary | null>(null);
  const [channelConversion, setChannelConversion] = useState<ChannelConversionMetrics | null>(null);
  const [channelCommission, setChannelCommission] = useState<ChannelCommissionReport | null>(null);
  const [channelGamification, setChannelGamification] = useState<ChannelGamification | null>(null);

  useEffect(() => {
    if (user?.role === "admin" || user?.role === "super_admin") {
      getFinanceMismatches(5)
        .then((data) => setMismatches(data.items as MismatchItem[]))
        .catch(() => {
          /* sessiz hata */
        });
    }
  }, [user?.role]);

  useEffect(() => {
    let mounted = true;
    void getWorkspacePanelConfig()
      .then((config) => {
        if (mounted) setWorkspacePanelConfig(config);
      })
      .catch(() => {
        if (mounted) setWorkspacePanelConfig(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const isChannelWorkspace = getUserScopeType(user) === "channel";

  const roleLabel = getUserDisplayRoleLabel(user);
  const roleIcon = getRoleIcon(normalizedBusinessRole(user));
  const userName = user?.full_name || "Buyera Asistans";
  const userEmail = user?.email || "";
  const activeWorkspacePanelProfile = resolveWorkspacePanelProfile(
    user,
    mergeWorkspacePanelConfig(workspacePanelConfig),
  );
  const workspaceTheme = buildWorkspacePanelTheme(activeWorkspacePanelProfile);

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

    return () => {
      mounted = false;
    };
  }, [isChannelWorkspace]);

  const channelLoading =
    isChannelWorkspace &&
    channelSummary === null &&
    channelConversion === null &&
    channelCommission === null &&
    channelGamification === null;

  if (!user) return <PageLoader text="Kullanıcı bilgileri yükleniyor..." />;

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__container">
        <WorkspaceHeroCard
          title={activeWorkspacePanelProfile?.hero_title || "Platform Yönetim Paneli"}
          subtitle={activeWorkspacePanelProfile?.hero_description || `${roleIcon} Platform Super Admin • ${roleLabel}`}
          userName={userName}
          userEmail={userEmail}
          accentGradient={workspaceTheme.accentGradient}
          topNotice={workspaceTheme.topNotice}
          headerInfo={workspaceTheme.headerInfo}
          footerInfo={workspaceTheme.footerInfo}
          headerBgColor={workspaceTheme.headerBgColor}
          headerTextColor={workspaceTheme.headerTextColor}
          footerBgColor={workspaceTheme.footerBgColor}
          footerTextColor={workspaceTheme.footerTextColor}
          heroTextColor={workspaceTheme.heroTextColor}
          heroMutedTextColor={workspaceTheme.heroMutedTextColor}
        />

        {mismatches.length > 0 && (
          <section className="dashboard-page__section">
            <h3 className="dashboard-page__section-title">⚠️ Finans Uyarıları</h3>
            <div className="dashboard-page__mismatch-list">
              {mismatches.map((mismatch) => (
                <article key={mismatch.supplier_id} className="dashboard-page__mismatch-card">
                  <div className="dashboard-page__mismatch-main">
                    <div className="dashboard-page__mismatch-name">
                      <Link
                        to={`/admin/suppliers/${mismatch.supplier_id}`}
                        className="dashboard-page__mismatch-link"
                      >
                        {mismatch.supplier_name}
                      </Link>
                    </div>
                    <div className="dashboard-page__mismatch-alerts">
                      {mismatch.alerts.join(" • ")}
                    </div>
                  </div>
                  <div className="dashboard-page__mismatch-totals">
                    <div>Sözleşme: {mismatch.totals.contract_total.toLocaleString("tr-TR")}</div>
                    <div>Fatura: {mismatch.totals.invoice_total.toLocaleString("tr-TR")}</div>
                    <div>Ödeme: {mismatch.totals.payment_total.toLocaleString("tr-TR")}</div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {isChannelWorkspace && (
          <section className="dashboard-page__channel">
            <div className="dashboard-page__channel-banner">
              İş ortağı dashboardında teklif listesi kapalı. Bu alan kanal performansı, komisyon
              ve ekip yönetimi odaklı çalışır.
            </div>

            <div className="dashboard-page__metrics-grid">
              <div className="dashboard-page__metric-card">
                <div className="dashboard-page__metric-label">Ekip (Aktif/Toplam)</div>
                <div className="dashboard-page__metric-value">
                  {channelLoading
                    ? "..."
                    : `${channelSummary?.active_team_size ?? 0}/${channelSummary?.total_team_size ?? 0}`}
                </div>
              </div>
              <div className="dashboard-page__metric-card">
                <div className="dashboard-page__metric-label">30 Gün Yeni Müşteri</div>
                <div className="dashboard-page__metric-value">
                  {channelLoading ? "..." : channelSummary?.last_30d_new_customers ?? 0}
                </div>
              </div>
              <div className="dashboard-page__metric-card">
                <div className="dashboard-page__metric-label">Donusum (Tiklama/Kayit)</div>
                <div className="dashboard-page__metric-value">
                  {channelLoading ? "..." : `${channelConversion?.clicks ?? 0}/${channelConversion?.signups ?? 0}`}
                </div>
              </div>
              <div className="dashboard-page__metric-card">
                <div className="dashboard-page__metric-label">Aylik Net Komisyon</div>
                <div className="dashboard-page__metric-value">
                  {channelLoading
                    ? "..."
                    : `${Number(
                        channelSummary?.commission_net_current_month ?? channelCommission?.totals?.net ?? 0,
                      ).toLocaleString("tr-TR")} TL`}
                </div>
              </div>
              <div className="dashboard-page__metric-card">
                <div className="dashboard-page__metric-label">Seviye</div>
                <div className="dashboard-page__metric-value">
                  {channelLoading ? "..." : channelGamification?.level_code ?? "L0"}
                </div>
              </div>
            </div>

            <div className="dashboard-page__howto">
              <div className="dashboard-page__howto-title">Nasil Kullanilir?</div>
              <div className="dashboard-page__howto-text">
                1) Kanal panel ayarlari icin{" "}
                <Link to="/admin" className="dashboard-page__inline-link">
                  Kanal Sahibi Paneli
                </Link>{" "}
                sekmesine gidin.
                <br />
                2) Kisisel bilgiler ve sifre islemleri icin sag ustteki Profilim butonunu
                kullanin.
                <br />
                3) Bu dashboard teklif acma ekrani yerine kanal performansini ve komisyon
                durumunu hizli takip etmek icin tasarlandi.
              </div>
            </div>
          </section>
        )}
      </div>

      {!isChannelWorkspace && <QuoteList showHero={false} />}
    </div>
  );
}
