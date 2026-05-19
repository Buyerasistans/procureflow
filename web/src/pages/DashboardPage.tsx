// FILE: web\src\pages\DashboardPage.tsx
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import PageLoader from "../components/PageLoader";
import QuoteList from "../components/QuoteList";
import { useEffect, useState } from "react";
import { getFinanceMismatches, getWorkspacePanelConfig, type WorkspacePanelConfig } from "../services/admin.service";
import WorkspaceHeroCard from "../components/WorkspaceHeroCard";
import { getUserDisplayRoleLabel, getRoleIcon, getUserScopeType, normalizedBusinessRole } from "../auth/permissions";
import { buildWorkspacePanelTheme, mergeWorkspacePanelConfig, resolveWorkspacePanelProfile } from "../admin/workspace-panels";
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
        .catch(() => {/* sessiz hata */});
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
  const activeWorkspacePanelProfile = resolveWorkspacePanelProfile(user, mergeWorkspacePanelConfig(workspacePanelConfig));
  const workspaceTheme = buildWorkspacePanelTheme(activeWorkspacePanelProfile);

  useEffect(() => {
    if (!isChannelWorkspace) return;
    let mounted = true;
    Promise.all([
      getChannelProfileSummary().catch(() => null),
      getChannelConversionMetrics("30d").catch(() => null),
      getChannelCommissionReport("30d").catch(() => null),
      getChannelGamification().catch(() => null),
    ])
      .then(([summary, conversion, commission, gamification]) => {
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

  const channelLoading = isChannelWorkspace
    && channelSummary === null
    && channelConversion === null
    && channelCommission === null
    && channelGamification === null;

  if (!user) return <PageLoader text="Kullanıcı bilgileri yükleniyor..." />;

  return (
    <div style={{ fontFamily: "Arial" }}>
      <div style={{ maxWidth: 1080, margin: "8px auto", padding: 16 }}>
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
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 10px 0", fontSize: 15, color: "#991b1b" }}>⚠️ Finans Uyarıları</h3>
            <div style={{ display: "grid", gap: 8 }}>
              {mismatches.map((m) => (
                <div
                  key={m.supplier_id}
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "#991b1b" }}>
                      <Link to={`/admin/suppliers/${m.supplier_id}`} style={{ color: "#991b1b", textDecoration: "underline" }}>
                        {m.supplier_name}
                      </Link>
                    </div>
                    <div style={{ fontSize: 12, color: "#7f1d1d", marginTop: 2 }}>
                      {m.alerts.join(" • ")}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#b91c1c", textAlign: "right", flexShrink: 0 }}>
                    <div>Sözleşme: {m.totals.contract_total.toLocaleString("tr-TR")}</div>
                    <div>Fatura: {m.totals.invoice_total.toLocaleString("tr-TR")}</div>
                    <div>Ödeme: {m.totals.payment_total.toLocaleString("tr-TR")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isChannelWorkspace && (
          <div style={{ marginBottom: 18 }}>
            <div style={{
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1e3a8a",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13,
              marginBottom: 12,
            }}>
              Is ortagi dashboardinda teklif listesi kapali. Bu alan kanal performansi, komisyon ve ekip yonetimi odakli calisir.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Ekip (Aktif/Toplam)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                  {channelLoading ? "..." : `${channelSummary?.active_team_size ?? 0}/${channelSummary?.total_team_size ?? 0}`}
                </div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>30 Gun Yeni Musteri</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                  {channelLoading ? "..." : channelSummary?.last_30d_new_customers ?? 0}
                </div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Donusum (Tiklama/Kayit)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                  {channelLoading ? "..." : `${channelConversion?.clicks ?? 0}/${channelConversion?.signups ?? 0}`}
                </div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Aylik Net Komisyon</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                  {channelLoading
                    ? "..."
                    : `${Number(channelSummary?.commission_net_current_month ?? channelCommission?.totals?.net ?? 0).toLocaleString("tr-TR")} TL`}
                </div>
              </div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, background: "#fff" }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Seviye</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                  {channelLoading ? "..." : channelGamification?.level_code ?? "L0"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff", padding: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Nasil Kullanilir?</div>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                1) Kanal panel ayarlari icin <Link to="/admin" style={{ color: "#1d4ed8" }}>Kanal Sahibi Paneli</Link> sekmesine gidin.<br />
                2) Kisisel bilgiler ve sifre islemleri icin sag ustteki Profilim butonunu kullanin.<br />
                3) Bu dashboard teklif acma ekrani yerine kanal performansini ve komisyon durumunu hizli takip etmek icin tasarlandi.
              </div>
            </div>
          </div>
        )}
      </div>

      {!isChannelWorkspace && <QuoteList showHero={false} />}
    </div>
  );
}
