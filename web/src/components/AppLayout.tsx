// FILE: web\src\components\AppLayout.tsx
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Mail } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { notify } from "../lib/notify";
import { getVisibleNavItems } from "../config/navigation";
import { canAccessProcurementSettings, canManageSharedEmailProfiles, getRoleIcon, getScopeLabel, getUserDisplayRoleLabel, getUserScopeType, getWorkspaceLabelFallback, hasPermissionForUser, isSuperAdminUser, normalizedBusinessRole } from "../auth/permissions";
import { useEffect, useMemo, useState } from "react";
import PublicBrandLogo from "./PublicBrandLogo";
import { getMailCenterAccounts } from "../services/mail-center.service";
import { getDashboardMailButtonConfig } from "../services/mail-center.service";
import { getMyProfile, type UserProfile } from "../services/profile.service";
import MailCenterPopup from "./MailCenterPopup";
import { getWorkspacePanelConfig, type WorkspacePanelConfig } from "../services/admin.service";
import { buildWorkspacePanelTheme, mergeWorkspacePanelConfig, resolveWorkspacePanelProfile } from "../admin/workspace-panels";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLocale } from "../context/LocaleContext";
import { usePublicTranslations } from "../hooks/usePublicTranslations";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { locale } = useLocale();
  const shellT = usePublicTranslations("app_shell", locale, {
    dashboard: "Dashboard",
    quotes: "Teklifler",
    reports: "Raporlar",
    ai_lab: "AI Keşif Lab",
    profile: "Profilim",
    logout: "Çıkış Yap",
    mail_summary: "Mail hesap özeti",
    mail_priority: "Öncelik",
    dashboard_mail_button: "dashboard mail butonu",
    active: "Aktif",
    passive: "Pasif",
    mailbox_not_found: "Açılabilir mailbox bulunamadı.",
  });
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [mailAccounts, setMailAccounts] = useState<Array<{ id: number; email: string; unread_count: number }>>([]);
  const [mailMenuOpen, setMailMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mailPopupOpen, setMailPopupOpen] = useState(false);
  const [mailPopupAccountId, setMailPopupAccountId] = useState<number | null>(null);
  const [dashboardMailButtonEnabled, setDashboardMailButtonEnabled] = useState(true);
  const [workspacePanelConfig, setWorkspacePanelConfig] = useState<WorkspacePanelConfig | null>(null);
  const workspaceName = user?.organization_name || user?.platform_name || "Buyera Asistans";
  const workspaceLabelFallback = getWorkspaceLabelFallback(user);
  const logoUrl = user?.organization_logo_url;

  function handleLogout() {
    logout();
    notify.info("Çıkış yapıldı.");
    navigate("/login", { replace: true });
    setMenuOpen(false);
  }

  function handleProfileClick() {
    navigate("/profile");
    setMenuOpen(false);
  }

  const visibleItems = user
    ? getVisibleNavItems(user).filter((item) => hasPermissionForUser(user, item.permission))
    : [];
  const normalizedRole = normalizedBusinessRole(user);
  const scopeType = getUserScopeType(user);
  const scopeLabel = getScopeLabel(scopeType);
  const isSuperAdmin = isSuperAdminUser(user);
  const roleIcon = getRoleIcon(normalizedRole);
  const roleLabel = getUserDisplayRoleLabel(user);
  const isChannelWorkspaceUser = normalizedRole.startsWith("channel_");
  const canUseMailCenterByRole =
    canAccessProcurementSettings(user)
    || canManageSharedEmailProfiles(user)
    || isChannelWorkspaceUser
    || scopeType === "partner"
    || scopeType === "supplier";
  const canUseMailCenter = canUseMailCenterByRole && (isSuperAdmin || dashboardMailButtonEnabled);
  const isEmbedded = useMemo(() => new URLSearchParams(location.search).get("embedded") === "1", [location.search]);

  /* â”€â”€â”€ Scope-aware header gradient â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const roleBasedHeaderGradient = isChannelWorkspaceUser
    ? "linear-gradient(135deg, #2f1a0d 0%, #4b2a12 52%, #6b3a14 100%)"
    : normalizedRole.startsWith("platform")
      ? "linear-gradient(135deg, #2a3f67 0%, #344d7a 52%, #4d6489 100%)"
      : "linear-gradient(135deg, #112a25 0%, #173630 52%, #20463e 100%)";
  const activeWorkspacePanelProfile = resolveWorkspacePanelProfile(user, mergeWorkspacePanelConfig(workspacePanelConfig));
  const workspaceTheme = buildWorkspacePanelTheme(activeWorkspacePanelProfile);
  const headerGradient = workspaceTheme.accentGradient || roleBasedHeaderGradient;
  const headerTextColor = workspaceTheme.heroTextColor || "#f8fafc";
  const navChipBackground = workspaceTheme.headerBgColor || "rgba(255,255,255,0.06)";
  const navChipColor = workspaceTheme.heroMutedTextColor || "#e5ece8";

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

  useEffect(() => {
    let mounted = true;
    if (!user) {
      return undefined;
    }
    void getDashboardMailButtonConfig()
      .then((settings) => {
        if (!mounted) return;
        setDashboardMailButtonEnabled(settings.dashboard_mail_button_enabled !== false);
      })
      .catch(() => {
        if (!mounted) return;
        setDashboardMailButtonEnabled(true);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;
    if (!user || !canUseMailCenter) {
      return undefined;
    }
    const loadUnread = async () => {
      try {
        const [accounts, profileData] = await Promise.all([
          getMailCenterAccounts(),
          getMyProfile().catch(() => null),
        ]);
        if (mounted) {
          setMailAccounts(accounts.map((account) => ({ id: account.id, email: account.email, unread_count: account.unread_count || 0 })));
          setMailUnreadCount(accounts.reduce((sum, account) => sum + (account.unread_count || 0), 0));
          setProfile(profileData);
        }
      } catch {
        if (mounted) {
          setMailUnreadCount(0);
          setMailAccounts([]);
          setProfile(null);
        }
      }
    };
    void loadUnread();
    const intervalId = window.setInterval(() => {
      void loadUnread();
    }, 45000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [canUseMailCenter, user]);

  const personalMailAddress = String(profile?.email || user?.email || "").trim().toLowerCase();
  const workMailAddress = String(profile?.work_email || user?.work_email || "").trim().toLowerCase();
  const isPlatformMailboxAddress = (address: string) => address.endsWith("@buyerasistans.com.tr");
  const preferredMailAccount =
    mailAccounts.find((account) => String(account.email || "").trim().toLowerCase() === personalMailAddress)
    || mailAccounts.find((account) => {
      const normalized = String(account.email || "").trim().toLowerCase();
      return normalized === workMailAddress && !isPlatformMailboxAddress(normalized);
    })
    || mailAccounts.find((account) => {
      const normalized = String(account.email || "").trim().toLowerCase();
      return normalized === workMailAddress;
    })
    || mailAccounts.find((account) => !isPlatformMailboxAddress(String(account.email || "").trim().toLowerCase()))
    || mailAccounts[0]
    || null;

  function openMail(accountId?: number) {
    const resolvedAccountId = accountId || preferredMailAccount?.id;
    setMailPopupAccountId(resolvedAccountId || null);
    setMailPopupOpen(true);
    setMailMenuOpen(false);
    setMenuOpen(false);
  }

  if (isEmbedded) {
    return (
      <div style={{ fontFamily: "Arial", minHeight: "100vh", background: "#ffffff" }}>
        <main style={{ padding: 0, maxWidth: "none", margin: 0 }}>
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Arial", minHeight: "100vh", background: "#f4f5f2" }}>
      <header
        style={{
          minHeight: 96,
          background: headerGradient,
          color: headerTextColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 22px",
          position: "relative",
          boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)",
        }}
      >
        <div style={{ display: "flex", gap: 26, alignItems: "center", minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "center", flexShrink: 0, marginRight: 4 }}>
            <div style={{ display: "flex", alignItems: "center", height: 36 }}>
              <PublicBrandLogo height={34} maxWidth={168} invert />
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0, height: 40 }}>
              {logoUrl ? (
                <img src={logoUrl} alt={workspaceName} style={{ width: 40, height: 40, borderRadius: 14, objectFit: "cover", border: "1px solid rgba(255,255,255,0.18)", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.14)", fontWeight: 800, flexShrink: 0 }}>
                  {workspaceName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{workspaceName}</div>
                <div style={{ fontSize: 11, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{workspaceLabelFallback}</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", minWidth: 0, height: 40, paddingTop: 40 }}>
            {visibleItems.map((item) => {
              const rawLabel = typeof item.label === "function" ? item.label(user!) : item.label;
              const itemLabel = ({
                "Dashboard": shellT.dashboard,
                "Teklifler": shellT.quotes,
                "Raporlar": shellT.reports,
                "AI Keşif Lab": shellT.ai_lab,
              } as Record<string, string>)[rawLabel] || rawLabel;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    color: navChipColor,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: navChipBackground,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}
                >
                  {itemLabel}
                </Link>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: "column", position: "relative" }}>
          <LanguageSwitcher />
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: headerTextColor,
              padding: "10px 14px",
              borderRadius: 14,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {roleIcon} {user?.full_name || user?.email}
          </button>

          {canUseMailCenter && (
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <button
                onClick={() => openMail()}
                style={{
                  background: mailUnreadCount > 0 ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" : "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
                  border: mailUnreadCount > 0 ? "1px solid rgba(147, 197, 253, 0.8)" : "1px solid rgba(94, 234, 212, 0.28)",
                  color: "#f8fafc",
                  padding: "10px 16px",
                  borderRadius: 14,
                  cursor: "pointer",
                  fontSize: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  fontWeight: 800,
                  boxShadow: mailUnreadCount > 0 ? "0 12px 24px rgba(37, 99, 235, 0.32)" : "0 10px 22px rgba(15, 118, 110, 0.22)",
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                }}
              >
                <Mail size={16} />
                Mail
                {mailUnreadCount > 0 && <span style={{ padding: "2px 8px", borderRadius: 999, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 800 }}>{mailUnreadCount}</span>}
              </button>
              <button
                onClick={() => setMailMenuOpen((current) => !current)}
                style={{
                  background: mailUnreadCount > 0 ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" : "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
                  border: mailUnreadCount > 0 ? "1px solid rgba(147, 197, 253, 0.8)" : "1px solid rgba(94, 234, 212, 0.28)",
                  borderLeft: "none",
                  color: "#f8fafc",
                  padding: "10px 10px",
                  borderRadius: 14,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  cursor: "pointer",
                  boxShadow: mailUnreadCount > 0 ? "0 12px 24px rgba(37, 99, 235, 0.32)" : "0 10px 22px rgba(15, 118, 110, 0.22)",
                }}
              >
                <ChevronDown size={14} />
              </button>
              {mailMenuOpen && (
                <div style={{ position: "absolute", top: 56, right: 0, width: 320, backgroundColor: "#fff", border: "1px solid #dbe3ee", borderRadius: 16, boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)", zIndex: 25, overflow: "hidden" }}>
                  <div style={{ padding: 14, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{shellT.mail_summary}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                      {shellT.mail_priority}: {personalMailAddress || workMailAddress || "profil emaili"}
                    </div>
                    {!isSuperAdmin && (
                      <div style={{ marginTop: 4, fontSize: 11, color: "#1e40af" }}>
                        {scopeLabel} {shellT.dashboard_mail_button}: {dashboardMailButtonEnabled ? shellT.active : shellT.passive}
                      </div>
                    )}
                  </div>
                  {mailAccounts.length === 0 ? (
                    <div style={{ padding: 14, fontSize: 13, color: "#64748b" }}>{shellT.mailbox_not_found}</div>
                  ) : (
                    mailAccounts.map((account) => (
                      <button key={account.id} onClick={() => openMail(account.id)} style={{ width: "100%", display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: 14, textAlign: "left", border: "none", borderBottom: "1px solid #f1f5f9", background: preferredMailAccount?.id === account.id ? "#eff6ff" : "#fff", cursor: "pointer" }}>
                        <span style={{ color: "#0f172a", fontWeight: 700 }}>{account.email}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 999, background: account.unread_count > 0 ? "#dbeafe" : "#f1f5f9", color: account.unread_count > 0 ? "#1d4ed8" : "#64748b", fontSize: 11, fontWeight: 800 }}>{account.unread_count}</span>
                      </button>
                    ))
                  )}
                  <div style={{ padding: 12, background: "#f8fafc", fontSize: 12, color: "#64748b" }}>İş maili tanımlanırsa header önce o mailbox hesabını açar.</div>
                </div>
              )}
            </div>
          )}

          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: 64,
                right: 0,
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
                zIndex: 10,
                minWidth: 200,
              }}
            >
              <div style={{ padding: 8 }}>
                <div style={{ padding: "8px 16px", fontSize: 12, color: "#6b7280", borderBottom: "1px solid #e5e7eb", marginBottom: 4 }}>
                  {roleIcon} {roleLabel} • {user?.platform_name || "Buyera Asistans"}
                </div>
                <button
                  onClick={handleProfileClick}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#1f2937",
                    borderRadius: 4,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  ğŸ‘¤ {shellT.profile}
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 16px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "#ef4444",
                    borderRadius: 4,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fee2e2")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  ğŸšª {shellT.logout}
                </button>
              </div>
            </div>
          )}

          {/* Close menu on outside click */}
          {menuOpen && (
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 5,
              }}
            />
          )}
          {canUseMailCenter && mailMenuOpen && (
            <div
              onClick={() => setMailMenuOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 20 }}
            />
          )}
        </div>
      </header>

      <main style={{ padding: "10px 24px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <Outlet />
      </main>
      {canUseMailCenter && (
        <MailCenterPopup
          isOpen={mailPopupOpen}
          initialAccountId={mailPopupAccountId}
          onClose={() => setMailPopupOpen(false)}
        />
      )}
    </div>
  );
}


