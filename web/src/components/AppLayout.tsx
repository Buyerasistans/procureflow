// FILE: web\src\components\AppLayout.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Brain, Briefcase, ChevronDown, FileText, Globe2, Home, Mail, Shield, User, Wallet } from "lucide-react";

import { useAuth } from "../hooks/useAuth";
import { notify } from "../lib/notify";
import {
  AUTHENTICATED_TOP_NAV_POLICY_ITEMS,
  buildPolicyContext,
  resolveVisibleNavItems,
} from "../config/navigation-policy";
import {
  canAccessProcurementSettings,
  canManageSharedEmailProfiles,
  getRoleIcon,
  getScopeLabel,
  getUserDisplayRoleLabel,
  getUserScopeType,
  getWorkspaceLabelFallback,
  isSuperAdminUser,
  normalizedBusinessRole,
} from "../auth/permissions";
import PublicBrandLogo from "./PublicBrandLogo";
import { getMailCenterAccounts, getDashboardMailButtonConfig } from "../services/mail-center.service";
import { getMyProfile, type UserProfile } from "../services/profile.service";
import MailCenterPopup from "./MailCenterPopup";
import { getWorkspacePanelConfig, type WorkspacePanelConfig } from "../services/admin.service";
import {
  buildWorkspacePanelTheme,
  mergeWorkspacePanelConfig,
  resolveWorkspacePanelProfile,
} from "../admin/workspace-panels";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLocale } from "../context/LocaleContext";
import { usePublicTranslations } from "../hooks/usePublicTranslations";
import "./AppLayout.css";

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
  const logoUrl = (() => {
    const raw = user?.organization_logo_url?.trim();
    if (!raw) return null;
    try {
      const parsed = new URL(raw);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
    } catch {
      return null;
    }
  })();

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
    ? resolveVisibleNavItems(AUTHENTICATED_TOP_NAV_POLICY_ITEMS, buildPolicyContext(user))
    : [];
  const normalizedRole = normalizedBusinessRole(user);
  const scopeType = getUserScopeType(user);
  const scopeLabel = getScopeLabel(scopeType);
  const isSuperAdmin = isSuperAdminUser(user);
  const roleIcon = getRoleIcon(normalizedRole);
  const roleLabel = getUserDisplayRoleLabel(user);
  const isChannelWorkspaceUser = normalizedRole.startsWith("channel_");
  const canUseMailCenterByRole =
    canAccessProcurementSettings(user) ||
    canManageSharedEmailProfiles(user) ||
    isChannelWorkspaceUser ||
    scopeType === "partner" ||
    scopeType === "supplier";
  const canUseMailCenter = canUseMailCenterByRole && (isSuperAdmin || dashboardMailButtonEnabled);
  const isEmbedded = useMemo(
    () => new URLSearchParams(location.search).get("embedded") === "1",
    [location.search],
  );
  const isAdminPath = location.pathname.startsWith("/admin");
  const navStyle: "sidebar" | "top" = (() => {
    try { return (localStorage.getItem("pf_nav_style") as "sidebar" | "top") || "sidebar"; } catch { return "sidebar"; }
  })();

  const navLabelMap: Record<string, string> = {
    Dashboard: shellT.dashboard,
    Teklifler: shellT.quotes,
    Raporlar: shellT.reports,
    "AI Keşif Lab": shellT.ai_lab,
  };

  function navIcon(route: string) {
    const p = { size: 16, strokeWidth: 2.2 } as const;
    if (route === "/dashboard") return <Home {...p} />;
    if (route === "/quotes") return <FileText {...p} />;
    if (route.startsWith("/admin")) return <Shield {...p} />;
    if (route.includes("discovery-lab")) return <Brain {...p} />;
    if (route === "/reports") return <BarChart3 {...p} />;
    if (route === "/jobs") return <Briefcase {...p} />;
    if (route.includes("talent")) return <User {...p} />;
    if (route.includes("payout")) return <Wallet {...p} />;
    return <Globe2 {...p} />;
  }

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
          setMailAccounts(
            accounts.map((account) => ({
              id: account.id,
              email: account.email,
              unread_count: account.unread_count || 0,
            })),
          );
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
    mailAccounts.find((account) => String(account.email || "").trim().toLowerCase() === personalMailAddress) ||
    mailAccounts.find((account) => {
      const normalized = String(account.email || "").trim().toLowerCase();
      return normalized === workMailAddress && !isPlatformMailboxAddress(normalized);
    }) ||
    mailAccounts.find((account) => {
      const normalized = String(account.email || "").trim().toLowerCase();
      return normalized === workMailAddress;
    }) ||
    mailAccounts.find((account) => !isPlatformMailboxAddress(String(account.email || "").trim().toLowerCase())) ||
    mailAccounts[0] ||
    null;

  function openMail(accountId?: number) {
    const resolvedAccountId = accountId || preferredMailAccount?.id;
    setMailPopupAccountId(resolvedAccountId || null);
    setMailPopupOpen(true);
    setMailMenuOpen(false);
    setMenuOpen(false);
  }

  if (isEmbedded) {
    return (
      <div className="app-layout__embedded-root">
        <main className="app-layout__embedded-main">
          <Outlet />
        </main>
      </div>
    );
  }

  // Admin path: AdminShell provides its own full layout (sidebar + topbar)
  if (isAdminPath) {
    return <Outlet />;
  }

  // Top nav fallback — kullanıcı ayarlardan "Üst Navigasyon" seçtiyse
  if (navStyle === "top") {
    return (
      <div className="app-layout app-layout__theme">
        <style>{`
          .app-layout__theme {
            --app-layout-header-gradient: ${headerGradient};
            --app-layout-header-text: ${headerTextColor};
            --app-layout-nav-chip-bg: ${navChipBackground};
            --app-layout-nav-chip-color: ${navChipColor};
          }
        `}</style>

        <header className="app-layout__header">
          <div className="app-layout__header-left">
            <div className="app-layout__brand-stack">
              <div className="app-layout__brand-logo-row">
                <PublicBrandLogo height={34} maxWidth={168} invert />
              </div>
              <div className="app-layout__workspace-row">
                {logoUrl ? (
                  <div
                    className="app-layout__workspace-logo"
                    style={{ backgroundImage: `url(${JSON.stringify(logoUrl)})` }}
                    role="img"
                    aria-label={workspaceName}
                  />
                ) : (
                  <div className="app-layout__workspace-fallback">
                    {workspaceName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="app-layout__workspace-copy">
                  <div className="app-layout__workspace-name">{workspaceName}</div>
                  <div className="app-layout__workspace-label">{workspaceLabelFallback}</div>
                </div>
              </div>
            </div>

            <div className="app-layout__nav-row">
              {visibleItems.map((item) => {
                const itemLabel = navLabelMap[item.label] ?? item.label;
                return (
                  <Link key={item.route} to={item.route} className="app-layout__nav-chip">
                    {itemLabel}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="app-layout__actions">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setMenuOpen((c) => !c)}
              className="app-layout__user-button"
            >
              {roleIcon} {user?.full_name || user?.email}
            </button>

            {canUseMailCenter && (
              <div className="app-layout__mail-group">
                <button
                  type="button"
                  onClick={() => openMail()}
                  className={`app-layout__mail-button ${mailUnreadCount > 0 ? "app-layout__mail-button--unread" : "app-layout__mail-button--read"}`}
                >
                  <Mail size={16} />
                  <span className="app-layout__mail-title">Mail</span>
                  {mailUnreadCount > 0 && <span className="app-layout__mail-badge">{mailUnreadCount}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setMailMenuOpen((c) => !c)}
                  aria-label={mailMenuOpen ? "Mail seçeneklerini kapat" : "Mail seçeneklerini aç"}
                  className={`app-layout__mail-button app-layout__mail-button-toggle ${mailUnreadCount > 0 ? "app-layout__mail-button--unread" : "app-layout__mail-button--read"}`}
                >
                  <ChevronDown size={14} />
                </button>
                {mailMenuOpen && (
                  <div className="app-layout__mail-popover">
                    <div className="app-layout__mail-popover-header">
                      <div className="app-layout__mail-popover-title">{shellT.mail_summary}</div>
                      <div className="app-layout__mail-popover-subtitle">
                        {shellT.mail_priority}: {personalMailAddress || workMailAddress || "profil emaili"}
                      </div>
                      {!isSuperAdmin && (
                        <div className="app-layout__mail-popover-status">
                          {scopeLabel} {shellT.dashboard_mail_button}:{" "}
                          {dashboardMailButtonEnabled ? shellT.active : shellT.passive}
                        </div>
                      )}
                    </div>
                    {mailAccounts.length === 0 ? (
                      <div className="app-layout__mail-popover-empty">{shellT.mailbox_not_found}</div>
                    ) : (
                      mailAccounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => openMail(account.id)}
                          className={`app-layout__mail-option ${preferredMailAccount?.id === account.id ? "app-layout__mail-option--selected" : ""}`}
                        >
                          <span className="app-layout__mail-option-email">{account.email}</span>
                          <span className={`app-layout__mail-option-count ${account.unread_count > 0 ? "app-layout__mail-option-count--unread" : ""}`}>
                            {account.unread_count}
                          </span>
                        </button>
                      ))
                    )}
                    <div className="app-layout__mail-popover-footer">
                      İş maili tanımlanırsa header önce o mailbox hesabını açar.
                    </div>
                  </div>
                )}
              </div>
            )}

            {menuOpen && (
              <div className="app-layout__menu-popover">
                <div className="app-layout__menu-body">
                  <div className="app-layout__menu-role">
                    {roleIcon} {roleLabel} • {user?.platform_name || "Buyera Asistans"}
                  </div>
                  <button type="button" onClick={handleProfileClick} className="app-layout__menu-button app-layout__menu-button--profile">
                    👤 {shellT.profile}
                  </button>
                  <button type="button" onClick={handleLogout} className="app-layout__menu-button app-layout__menu-button--logout">
                    🚪 {shellT.logout}
                  </button>
                </div>
              </div>
            )}
            {menuOpen && <div onClick={() => setMenuOpen(false)} className="app-layout__overlay" />}
            {canUseMailCenter && mailMenuOpen && (
              <div onClick={() => setMailMenuOpen(false)} className="app-layout__overlay app-layout__overlay--mail" />
            )}
          </div>
        </header>

        <main className="app-layout__main">
          <Outlet />
        </main>

        {canUseMailCenter && (
          <MailCenterPopup isOpen={mailPopupOpen} initialAccountId={mailPopupAccountId} onClose={() => setMailPopupOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="app-layout app-layout--sidebar app-layout__theme">
      <style>{`
        .app-layout__theme {
          --app-layout-header-gradient: ${headerGradient};
          --app-layout-header-text: ${headerTextColor};
          --app-layout-nav-chip-bg: ${navChipBackground};
          --app-layout-nav-chip-color: ${navChipColor};
        }
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside className="app-layout__sidebar">
        <div className="app-layout__sb-brand">
          <PublicBrandLogo height={26} maxWidth={130} invert />
        </div>

        <div className="app-layout__sb-workspace">
          <div className="app-layout__sb-ws-av">
            {logoUrl ? (
              <div
                className="app-layout__sb-ws-logo-bg"
                style={{ backgroundImage: `url(${JSON.stringify(logoUrl)})` }}
                role="img"
                aria-label={workspaceName}
              />
            ) : (
              <div className="app-layout__sb-ws-fallback">{workspaceName.slice(0, 2).toUpperCase()}</div>
            )}
          </div>
          <div className="app-layout__sb-ws-info">
            <div className="app-layout__sb-ws-name">{workspaceName}</div>
            <div className="app-layout__sb-ws-role">{workspaceLabelFallback}</div>
          </div>
        </div>

        <nav className="app-layout__sb-nav" aria-label="Ana menü">
          {visibleItems.map((item) => {
            const itemLabel = navLabelMap[item.label] ?? item.label;
            const isActive = location.pathname === item.route
              || (item.route !== "/" && location.pathname.startsWith(item.route + "/"));
            return (
              <Link
                key={item.route}
                to={item.route}
                className={`app-layout__sb-nav-item${isActive ? " app-layout__sb-nav-item--active" : ""}`}
              >
                <span className="app-layout__sb-nav-ico">{navIcon(item.route)}</span>
                <span className="app-layout__sb-nav-label">{itemLabel}</span>
              </Link>
            );
          })}
        </nav>

        <div className="app-layout__sb-footer">
          <span>{scopeLabel || user?.platform_name || "Buyera Asistans"}</span>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="app-layout__sb-main">
        <header className="app-layout__sb-topbar">
          <div className="app-layout__actions">
            <LanguageSwitcher compact />

            {canUseMailCenter && (
              <div className="app-layout__mail-group">
                <button
                  type="button"
                  onClick={() => openMail()}
                  className={`app-layout__mail-button ${
                    mailUnreadCount > 0 ? "app-layout__mail-button--unread" : "app-layout__mail-button--read"
                  }`}
                >
                  <Mail size={16} />
                  <span className="app-layout__mail-title">Mail</span>
                  {mailUnreadCount > 0 && (
                    <span className="app-layout__mail-badge">{mailUnreadCount}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMailMenuOpen((current) => !current)}
                  aria-label={mailMenuOpen ? "Mail seçeneklerini kapat" : "Mail seçeneklerini aç"}
                  title={mailMenuOpen ? "Mail seçeneklerini kapat" : "Mail seçeneklerini aç"}
                  className={`app-layout__mail-button app-layout__mail-button-toggle ${
                    mailUnreadCount > 0 ? "app-layout__mail-button--unread" : "app-layout__mail-button--read"
                  }`}
                >
                  <ChevronDown size={14} />
                </button>

                {mailMenuOpen && (
                  <div className="app-layout__mail-popover">
                    <div className="app-layout__mail-popover-header">
                      <div className="app-layout__mail-popover-title">{shellT.mail_summary}</div>
                      <div className="app-layout__mail-popover-subtitle">
                        {shellT.mail_priority}: {personalMailAddress || workMailAddress || "profil emaili"}
                      </div>
                      {!isSuperAdmin && (
                        <div className="app-layout__mail-popover-status">
                          {scopeLabel} {shellT.dashboard_mail_button}:{" "}
                          {dashboardMailButtonEnabled ? shellT.active : shellT.passive}
                        </div>
                      )}
                    </div>
                    {mailAccounts.length === 0 ? (
                      <div className="app-layout__mail-popover-empty">{shellT.mailbox_not_found}</div>
                    ) : (
                      mailAccounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => openMail(account.id)}
                          className={`app-layout__mail-option ${
                            preferredMailAccount?.id === account.id ? "app-layout__mail-option--selected" : ""
                          }`}
                        >
                          <span className="app-layout__mail-option-email">{account.email}</span>
                          <span
                            className={`app-layout__mail-option-count ${
                              account.unread_count > 0 ? "app-layout__mail-option-count--unread" : ""
                            }`}
                          >
                            {account.unread_count}
                          </span>
                        </button>
                      ))
                    )}
                    <div className="app-layout__mail-popover-footer">
                      İş maili tanımlanırsa header önce o mailbox hesabını açar.
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="app-layout__user-button"
            >
              {roleIcon} {user?.full_name || user?.email}
            </button>

            {menuOpen && (
              <div className="app-layout__menu-popover">
                <div className="app-layout__menu-body">
                  <div className="app-layout__menu-role">
                    {roleIcon} {roleLabel} • {user?.platform_name || "Buyera Asistans"}
                  </div>
                  <button
                    type="button"
                    onClick={handleProfileClick}
                    className="app-layout__menu-button app-layout__menu-button--profile"
                  >
                    👤 {shellT.profile}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="app-layout__menu-button app-layout__menu-button--logout"
                  >
                    🚪 {shellT.logout}
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="app-layout__main">
          <Outlet />
        </main>
      </div>

      {menuOpen && <div onClick={() => setMenuOpen(false)} className="app-layout__overlay" />}
      {canUseMailCenter && mailMenuOpen && (
        <div onClick={() => setMailMenuOpen(false)} className="app-layout__overlay app-layout__overlay--mail" />
      )}

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
