import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Briefcase,
  Building,
  Building2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  FlaskConical,
  FolderOpen,
  Handshake,
  HelpCircle,
  Home,
  LayoutDashboard,
  LayoutGrid,
  Mail,
  Megaphone,
  Package,
  Palette,
  Rocket,
  Search,
  Settings2,
  Shield,
  SlidersHorizontal,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  Link2,
} from "lucide-react";
import type { AuthUser } from "../../context/auth-types";
import { isSuperAdminUser, getUserDisplayRoleLabel } from "../../auth/permissions";
import { defaultAccentColorForBusinessRole } from "../../admin/workspace-panels";
import { PANEL_COLORS, publishPanelProfile } from "../../admin/panel-colors";
import type { SegmentKey } from "../../admin/panel-colors";
import { usePanelThemeLiveReload } from "../../hooks/usePanelThemeLiveReload";
import { usePanelProfileLiveReload } from "../../hooks/usePanelProfileLiveReload";
import { getMyPanelProfile } from "../../services/admin.service";
import PanelTopHeader from "./PanelTopHeader";
import { ADMIN_NAV_GROUPS, navLabelForKey } from "./adminNav";
import type { AdminNavItem } from "./adminNav";
import LanguageSwitcher from "../../components/LanguageSwitcher";
import { getMailCenterAccounts } from "../../services/mail-center.service";
import { useAuth } from "../../hooks/useAuth";
import { notify } from "../../lib/notify";
import MailCenterPopup from "../../components/MailCenterPopup";
import "./adminShell.css";

// ─── Nav-config types (mirrors NavManagerTab) ────────────────
type NmVis = "show" | "lock" | "hide";
type NmPlacement = "top" | "side" | "both" | "hidden";
type NmCfg = {
  layoutMode: "single" | "top" | "dual";
  menuStyle: "expanded" | "dropdown";
  order: string[];
  items: Record<string, { placement: NmPlacement; enabled: boolean; roles: Record<string, NmVis> }>;
};

// ─── Mock notifications (TODO: replace with API) ─────────────
const SHELL_NOTIFS_INIT = [
  { id: 1, icon: "studio",  color: "#b45309", title: "9 kurulum kuyruğunda",  desc: "Onboarding tamamlanmamış partnerler", time: "5 dk",  read: false, target: "onboarding_studio"  },
  { id: 2, icon: "partner", color: "#1d4ed8", title: "Yeni üyelik başvurusu", desc: "Stratejik partner 001 onay bekliyor",  time: "22 dk", read: false, target: "tenant_governance"  },
  { id: 3, icon: "help",    color: "#be123c", title: "2 destek SLA riski",    desc: "Yanıt süresi aşılmak üzere",          time: "1 sa",  read: false, target: "support_tickets"    },
  { id: 4, icon: "wallet",  color: "#047857", title: "18 komisyon ödemesi",   desc: "Onay bekleyen hak edişler",           time: "3 sa",  read: true,  target: "commission_admin"   },
];

function readNavCfg(): NmCfg | null {
  try {
    const s = localStorage.getItem("pf_nav_config");
    if (s) { const p = JSON.parse(s) as NmCfg; if (p?.items && p?.order) return p; }
  } catch { /* ignore */ }
  return null;
}

function resolveUserSegmentKey(user: AuthUser | null, superAdmin: boolean): SegmentKey {
  if (superAdmin) return "platform";
  const scope = String((user as { scope_type?: string } | null)?.scope_type ?? "").toLowerCase();
  if (scope === "supplier") return "supplier";
  if (scope === "channel")  return "channel";
  if (scope === "partner")  return "strategic";
  const biz = String(user?.business_role ?? user?.role ?? "").toLowerCase();
  // scope_type henüz set edilmemiş kullanıcılar için biz-rol'den türet
  if (biz === "channel_owner" || biz === "channel_agent" || biz === "kanal_ekip_lideri"
      || biz === "kanal_finans" || biz === "ozel_kanal_rolu") return "channel";
  const sys = String(user?.system_role ?? "").toLowerCase();
  if (sys === "tenant_owner" || sys === "tenant_member" || sys === "tenant_admin") return "strategic";
  if (biz === "employer_company_admin" || biz === "employer_recruiter") return "employer";
  if (biz === "candidate_user" || biz === "talent_member") return "seeker";
  return "platform";
}

function resolveNavRole(user: AuthUser | null, superAdmin: boolean): string {
  if (superAdmin) return "super_admin";
  const scope = String(user?.scope_type || "").toLowerCase();
  const biz   = String(user?.business_role || user?.role || "").toLowerCase();
  if (scope === "platform") {
    if (biz.includes("support") || biz.includes("destek")) return "platform_support";
    if (biz.includes("finans") || biz.includes("finance")) return "finance_officer";
    return "platform_operator";
  }
  if (scope === "supplier") return "supplier_user";
  if (scope === "channel")  return "channel_agent";
  // scope_type set edilmemiş channel kullanıcıları için biz-rol fallback
  if (biz === "channel_owner" || biz === "channel_agent" || biz === "kanal_ekip_lideri"
      || biz === "kanal_finans" || biz === "ozel_kanal_rolu") return "channel_agent";
  if (biz.includes("admin")) return "tenant_admin";
  return "tenant_member";
}

// ─── Props ────────────────────────────────────────────────────
type AdminShellProps = {
  activeKey: string;
  onNavigate: (key: string) => void;
  user: AuthUser | null;
  children: ReactNode;
  tabKeys?: string[];
  accentColor?: string | null;
};

// ─── Icon renderer ────────────────────────────────────────────
function NavIcon({ name }: { name: string }) {
  const props = { size: 16, strokeWidth: 2.2 } as const;
  switch (name) {
    case "home":      return <Home {...props} />;
    case "chart":     return <BarChart3 {...props} />;
    case "analytics": return <TrendingUp {...props} />;
    case "lab":       return <FlaskConical {...props} />;
    case "studio":    return <Layers16 />;
    case "cog":       return <Settings2 {...props} />;
    case "partner":   return <Building2 {...props} />;
    case "supplier":  return <Handshake {...props} />;
    case "rocket":    return <Rocket {...props} />;
    case "briefcase": return <Briefcase {...props} />;
    case "package":   return <Package {...props} />;
    case "price":     return <Tag {...props} />;
    case "megaphone": return <Megaphone {...props} />;
    case "wallet":    return <Wallet {...props} />;
    case "link":      return <Link2 {...props} />;
    case "building":  return <Building {...props} />;
    case "shield":    return <Shield {...props} />;
    case "grid":      return <LayoutGrid {...props} />;
    case "users":     return <Users {...props} />;
    case "folder":    return <FolderOpen {...props} />;
    case "check":     return <CheckSquare {...props} />;
    case "report":    return <FileBarChart {...props} />;
    case "help":      return <HelpCircle {...props} />;
    case "palette":   return <Palette {...props} />;
    case "sliders":    return <SlidersHorizontal {...props} />;
    case "workspace":  return <LayoutDashboard {...props} />;
    case "WRK":        return <LayoutDashboard {...props} />;
    default:           return <Home {...props} />;
  }
}

function Layers16() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function darkenHex(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const d = (c: number) => Math.max(0, Math.floor(c * (1 - amount)));
  const r = d(parseInt(h.slice(0, 2), 16));
  const g = d(parseInt(h.slice(2, 4), 16));
  const b = d(parseInt(h.slice(4, 6), 16));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function userInitials(user: AuthUser | null): string {
  if (!user) return "SA";
  const name = user.full_name?.trim() || user.email;
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── Component ───────────────────────────────────────────────
export default function AdminShell({ activeKey, onNavigate, user, children, tabKeys, accentColor }: AdminShellProps) {
  const activeLabel = navLabelForKey(activeKey);
  const { logout } = useAuth();
  const navigate = useNavigate();

  // ── Mail state ──
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [mailAccounts, setMailAccounts] = useState<Array<{ id: number; email: string; unread_count: number }>>([]);
  const [mailMenuOpen, setMailMenuOpen] = useState(false);
  const [mailPopupOpen, setMailPopupOpen] = useState(false);
  const [mailPopupAccountId, setMailPopupAccountId] = useState<number | null>(null);

  // ── Topbar dropdowns ──
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState(SHELL_NOTIFS_INIT);
  const notifUnread = notifs.filter((n) => !n.read).length;

  // ── Nav config (from NavManagerTab localStorage) ──
  const [navCfg, setNavCfg] = useState<NmCfg | null>(readNavCfg);
  // Groups open in accordion mode — all open by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(ADMIN_NAV_GROUPS.map((g) => g.label))
  );

  const isSuperAdmin = isSuperAdminUser(user);
  const roleLabel    = getUserDisplayRoleLabel(user) || (isSuperAdmin ? "Platform Süper Admin" : "Admin");
  const navRole      = resolveNavRole(user, isSuperAdmin);
  const segmentKey   = resolveUserSegmentKey(user, isSuperAdmin);

  // Canlı renk tazeleme: panelthemechange → :root --seg-* güncellemesi
  usePanelThemeLiveReload();

  // Rol-profili canlı tazeleme: sadece mevcut kullanıcının profil event'i uygulanır
  const _currentBiz = user?.business_role || user?.role || "";
  const _currentSys = user?.system_role || "";
  usePanelProfileLiveReload(_currentBiz || undefined, _currentSys || undefined);

  // Giriş sonrası: kullanıcının kendi rol profilini çek ve panele uygula
  useEffect(() => {
    const biz = user?.business_role || user?.role || "";
    const sys = user?.system_role || "";
    if (!biz) return;
    const SEG_DEFAULTS: Record<SegmentKey, { color: string; color2: string; accent: string; textColor: string }> = {
      platform:  { color: "#1d2b4a", color2: "#3A4F86", accent: "#3A4F86", textColor: "#f8fafc" },
      strategic: { color: "#112a25", color2: "#D4AF37", accent: "#134E37", textColor: "#f8fafc" },
      supplier:  { color: "#0c4a6e", color2: "#38bdf8", accent: "#0E7490", textColor: "#f0f9ff" },
      channel:   { color: "#2f1a0d", color2: "#f59e0b", accent: "#7C2D12", textColor: "#fff7ed" },
      employer:  { color: "#312e81", color2: "#6366f1", accent: "#5B21B6", textColor: "#eef2ff" },
      seeker:    { color: "#7f1d1d", color2: "#fb7185", accent: "#9F1239", textColor: "#fff1f2" },
      system:    { color: "#1d2b4a", color2: "#3A4F86", accent: "#3A4F86", textColor: "#f8fafc" },
    };
    // /me endpoint'i tüm kullanıcı türlerinde çalışır (tenant_member dahil), biz-fallback destekler
    getMyPanelProfile()
      .then((p) => {
        if (p) {
          publishPanelProfile({
            biz, sys,
            profile: {
              color:      p.color,
              color2:     p.color2,
              color2Mix:  typeof p.color2Mix === "number" ? p.color2Mix : 0.18,
              syncTopbar: p.syncTopbar === true,
              accent:     p.accent,
              textColor:  p.textColor,
            },
          });
        } else {
          // DB'de kayıtlı profil yok — segment varsayılanlarını yayınla
          const def = SEG_DEFAULTS[segmentKey];
          publishPanelProfile({
            biz, sys,
            profile: {
              color:      def.color,
              color2:     def.color2,
              color2Mix:  0.22,
              syncTopbar: false,
              accent:     def.accent,
              textColor:  def.textColor,
            },
          });
        }
      })
      .catch(() => { /* panele varsayılan CSS renkleri uygulanmaya devam eder */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // accentColor prop'u opsiyonel override olarak korunur (legacy uyumluluk)
  const _legacyAccentColor = accentColor ?? defaultAccentColorForBusinessRole(user?.business_role || "");
  void PANEL_COLORS; void _legacyAccentColor; // Faz 4: artık data-panel CSS var'ı kullanıyor
  const _pfNavStyleRaw = (() => { try { return localStorage.getItem("pf_nav_style") ?? ""; } catch { return ""; } })();
  const layoutMode   = navCfg?.layoutMode ?? (_pfNavStyleRaw === "top" ? "top" : "single");
  const menuStyle    = navCfg?.menuStyle  ?? "expanded";

  // ── Listen for nav config saves ──
  useEffect(() => {
    function onCfgChange() { setNavCfg(readNavCfg()); }
    window.addEventListener("navcfgchange", onCfgChange);
    return () => window.removeEventListener("navcfgchange", onCfgChange);
  }, []);

  // ── Mail polling ──
  useEffect(() => {
    let mounted = true;
    const loadMail = async () => {
      try {
        const accounts = await getMailCenterAccounts();
        if (mounted) {
          setMailAccounts(accounts.map((a) => ({ id: a.id, email: a.email, unread_count: a.unread_count || 0 })));
          setMailUnreadCount(accounts.reduce((sum, a) => sum + (a.unread_count || 0), 0));
        }
      } catch { /* ignore */ }
    };
    loadMail();
    const interval = setInterval(loadMail, 45_000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // ── Handlers ──
  function handleLogout() {
    if (!confirm("Çıkış yapmak istediğinize emin misiniz?")) return;
    logout();
    notify.info("Çıkış yapıldı.");
    navigate("/login", { replace: true });
    setMenuOpen(false);
  }
  function handleProfileClick()  { onNavigate("profile"); setMenuOpen(false); }
  function handleSettingsClick() { onNavigate("settings"); setMenuOpen(false); }
  function openMail(accountId?: number) {
    setMailPopupAccountId(accountId ?? mailAccounts[0]?.id ?? null);
    setMailPopupOpen(true);
    setMailMenuOpen(false);
  }
  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });
  }, []);

  // ── Sidebar visible groups ──
  const visibleGroups = useMemo(() => {
    // navCfg was configured for platform roles; fall back to tabKeys filtering
    // when it has no explicit role config for the current navRole (e.g. channel_agent)
    const navCfgHasRoleConfig = navCfg
      ? Object.values(navCfg.items).some((ci) => ci.roles?.[navRole] !== undefined)
      : false;

    if (!navCfg || !navCfgHasRoleConfig) {
      return tabKeys
        ? ADMIN_NAV_GROUPS
            .map((g) => ({ ...g, items: g.items.filter((i) => tabKeys.includes(i.key)) }))
            .filter((g) => g.items.length > 0)
        : ADMIN_NAV_GROUPS;
    }
    return ADMIN_NAV_GROUPS.map((group) => {
      let items = group.items.filter((item) => {
        const ci = navCfg.items[item.key];
        if (!ci || !ci.enabled || ci.placement === "hidden") return false;
        if (ci.roles[navRole] === "hide") return false;
        if (layoutMode === "top")  return false;
        if (layoutMode === "dual") return ci.placement === "side" || ci.placement === "both";
        return true;
      });
      if (tabKeys) items = items.filter((i) => tabKeys.includes(i.key));
      items = [...items].sort((a, b) => {
        const ai = navCfg.order.indexOf(a.key);
        const bi = navCfg.order.indexOf(b.key);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
      return { ...group, items };
    }).filter((g) => g.items.length > 0);
  }, [navCfg, tabKeys, navRole, layoutMode]);

  // ── Top-nav groups (dual / top modes) ──
  const topGroups = useMemo<Array<{ label: string; items: (AdminNavItem & { locked: boolean })[] }>>(() => {
    if (layoutMode === "single") return [];
    const meta: Record<string, AdminNavItem & { group: string }> = {};
    ADMIN_NAV_GROUPS.forEach((g) => g.items.forEach((i) => { meta[i.key] = { ...i, group: g.label }; }));
    if (!navCfg) {
      // pf_nav_style="top" fallback: build top nav from tabKeys without navCfg
      const allKeys = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.key));
      const visKeys = tabKeys ? allKeys.filter((k) => tabKeys.includes(k)) : allKeys;
      const groups: Array<{ label: string; items: (AdminNavItem & { locked: boolean })[] }> = [];
      const seen: Record<string, (typeof groups)[number]> = {};
      visKeys.forEach((k) => {
        const m = meta[k]; if (!m) return;
        if (!seen[m.group]) { seen[m.group] = { label: m.group, items: [] }; groups.push(seen[m.group]); }
        seen[m.group].items.push({ ...m, locked: false });
      });
      return groups;
    }
    const visKeys = navCfg.order.filter((k) => {
      const ci = navCfg.items[k];
      if (!ci?.enabled || ci.placement === "hidden") return false;
      if (ci.roles[navRole] === "hide") return false;
      if (layoutMode === "top")  return true;
      return ci.placement === "top" || ci.placement === "both";
    });
    const groups: Array<{ label: string; items: (AdminNavItem & { locked: boolean })[] }> = [];
    const seen: Record<string, (typeof groups)[number]> = {};
    visKeys.forEach((k) => {
      const m = meta[k]; if (!m) return;
      if (tabKeys && !tabKeys.includes(k)) return;
      if (!seen[m.group]) { seen[m.group] = { label: m.group, items: [] }; groups.push(seen[m.group]); }
      seen[m.group].items.push({ ...m, locked: navCfg.items[k].roles[navRole] === "lock" });
    });
    return groups;
  }, [navCfg, tabKeys, navRole, layoutMode]);

  // ─── RENDER ──────────────────────────────────────────────────
  const showTopNav  = layoutMode !== "single" && topGroups.length > 0;
  const showSidebar = layoutMode !== "top";

  return (
    <>
    <div
      className={`as-wrap${layoutMode !== "single" ? ` as-wrap--${layoutMode}` : ""}`}
      data-panel={segmentKey}
    >

      {/* ── PANEL TOP HEADER (full-width) ── */}
      <PanelTopHeader
        panelTitle={isSuperAdmin ? "Platform Süper Admin Paneli" : `${roleLabel} Paneli`}
        userName={user?.full_name ?? "Süper Admin"}
      />

      {/* ── TOP NAV (dual / top modes) ── */}
      {showTopNav && (
        <nav className="as-topnav" aria-label="Üst navigasyon">
          {topGroups.map((g) => (
            <div key={g.label} className="as-topnav__group">
              <button type="button" className="as-topnav__group-hd">
                {g.label} <ChevronDown size={11} />
              </button>
              <div className="as-topnav__dropdown">
                {g.items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`as-topnav__item${item.key === activeKey ? " as-topnav__item--active" : ""}${item.locked ? " as-topnav__item--locked" : ""}`}
                    onClick={() => !item.locked && onNavigate(item.key)}
                    disabled={item.locked}
                    title={item.label}
                  >
                    <span className="as-topnav__ico"><NavIcon name={item.icon} /></span>
                    <span>{item.label}</span>
                    {item.locked && <span className="as-topnav__lock">🔒</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}

      {/* ── SHELL ── */}
      <div className={`as-shell${layoutMode === "top" ? " as-shell--nav-top" : ""}`}>

        {/* ── SIDEBAR ── */}
        {showSidebar && (
        <aside className="as-sidebar">
          <div className="as-brand">
            <div className="as-tenant">
              <div className="as-tenant-avatar">{userInitials(user)}</div>
              <div>
                <div className="as-tenant-name">{user?.organization_name || user?.platform_name || "Buyer Asistans"}</div>
                <div className="as-tenant-role">{roleLabel}</div>
              </div>
            </div>
          </div>

          <nav aria-label="Yönetim menüsü">
            {visibleGroups.map((group) => {
              const isOpen   = menuStyle !== "dropdown" || openGroups.has(group.label);
              const isAccord = menuStyle === "dropdown";
              return (
                <div key={group.label} className={`as-nav-group${isAccord && !isOpen ? " as-nav-group--closed" : ""}`}>
                  {isAccord ? (
                    <button
                      type="button"
                      className="as-nav-group__hd"
                      onClick={() => toggleGroup(group.label)}
                    >
                      <span>{group.label}</span>
                      <span className="as-nav-group__chev">
                        {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                      </span>
                    </button>
                  ) : (
                    <h4>{group.label}</h4>
                  )}

                  {isOpen && group.items.map((item) => {
                    const isActive = item.key === activeKey;
                    const locked   = navCfg?.items[item.key]?.roles[navRole] === "lock";
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`as-nav-item${isActive ? " as-nav-item--active" : ""}${locked ? " as-nav-item--locked" : ""}`}
                        onClick={() => !locked && !isActive && onNavigate(item.key)}
                        aria-current={isActive ? "page" : undefined}
                        title={locked ? `${item.label} (kilitli)` : item.label}
                        disabled={locked}
                      >
                        <span className="as-nav-ico"><NavIcon name={item.icon} /></span>
                        <span className="as-nav-label">{item.label}</span>
                        {locked && <span className="as-nav-pill as-nav-pill--muted">🔒</span>}
                        {!locked && item.badge && <span className="as-nav-pill">{item.badge}</span>}
                        {!locked && item.alert && !item.badge && <span className="as-nav-pill as-nav-pill--alert">!</span>}
                        {!locked && item.count != null && <span className="as-nav-pill as-nav-pill--muted">{item.count}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <div className="as-sidebar-footer">
            <span>buyerasistans.com.tr</span>
            <span className="as-health-dot">● Sağlıklı</span>
          </div>
        </aside>
        )}

        {/* ── MAIN ── */}
        <div className="as-main">
          <header className="as-topbar">
            <nav className="as-crumbs" aria-label="Konum">
              <span>Yönetim</span>
              <span className="as-crumb-sep" aria-hidden="true">›</span>
              <b>{activeLabel}</b>
            </nav>

            <div className="as-search">
              <Search size={14} aria-hidden="true" />
              <input
                type="search"
                placeholder="Ara..."
                aria-label="Panel içi arama"
              />
              <kbd aria-hidden="true">⌘K</kbd>
            </div>

            <div className="as-top-actions">
              <LanguageSwitcher compact />

              <div className="as-action-group">
                <button
                  type="button"
                  className={`as-icon-btn${notifUnread > 0 ? " as-icon-btn--unread" : ""}`}
                  aria-label={`Bildirimler${notifUnread > 0 ? `, ${notifUnread} okunmamış` : ""}`}
                  onClick={() => setNotifOpen((c) => !c)}
                >
                  <Bell size={16} />
                  {notifUnread > 0 && <span className="as-notif-dot" />}
                </button>
                {notifOpen && (
                  <div className="as-notif-popover">
                    <div className="as-notif-popover__hd">
                      <b>Bildirimler</b>
                      {notifUnread > 0 && (
                        <button
                          type="button"
                          className="as-notif-popover__mark"
                          onClick={() => setNotifs((n) => n.map((x) => ({ ...x, read: true })))}
                        >
                          Tümünü okundu işaretle
                        </button>
                      )}
                    </div>
                    <div className="as-notif-list">
                      {notifs.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          className={`as-notif-item${n.read ? "" : " as-notif-item--unread"}`}
                          onClick={() => {
                            setNotifs((arr) => arr.map((x) => x.id === n.id ? { ...x, read: true } : x));
                            onNavigate(n.target);
                            setNotifOpen(false);
                          }}
                        >
                          <span className="as-notif-item__ico" style={{ "--nc": n.color } as React.CSSProperties}>
                            <NavIcon name={n.icon} />
                          </span>
                          <div className="as-notif-item__body">
                            <b>{n.title}</b>
                            <span>{n.desc}</span>
                          </div>
                          <span className="as-notif-item__time">{n.time}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="as-action-group">
                <button
                  type="button"
                  onClick={() => openMail()}
                  className={`as-mail-btn${mailUnreadCount > 0 ? " as-mail-btn--unread" : ""}`}
                  aria-label={`Mesajlar${mailUnreadCount > 0 ? `, ${mailUnreadCount} okunmamış` : ""}`}
                >
                  <Mail size={15} />
                  <span className="as-mail-btn-label">Mail</span>
                  {mailUnreadCount > 0 && <span className="as-mail-badge">{mailUnreadCount}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setMailMenuOpen((c) => !c)}
                  aria-label="Mail hesaplarını seç"
                  className={`as-icon-btn as-mail-chevron${mailUnreadCount > 0 ? " as-icon-btn--unread" : ""}`}
                >
                  <ChevronDown size={14} />
                </button>
                {mailMenuOpen && (
                  <div className="as-mail-popover">
                    {mailAccounts.length === 0 ? (
                      <div className="as-mail-popover-empty">Açılabilir mailbox bulunamadı.</div>
                    ) : (
                      mailAccounts.map((account) => (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => openMail(account.id)}
                          className="as-mail-option"
                        >
                          <span className="as-mail-option-email">{account.email}</span>
                          <span className={`as-mail-option-count${account.unread_count > 0 ? " as-mail-option-count--unread" : ""}`}>
                            {account.unread_count}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="as-action-group">
                <button
                  type="button"
                  className="as-user-chip"
                  onClick={() => setMenuOpen((c) => !c)}
                  aria-label={`Kullanıcı: ${user?.full_name ?? user?.email ?? "Süper Admin"}`}
                >
                  <div className="as-user-av" aria-hidden="true">{userInitials(user)}</div>
                  <div className="as-user-meta">
                    <b>{user?.full_name ?? "Süper Admin"}</b>
                    <span>{user?.email ?? ""}</span>
                  </div>
                </button>
                {menuOpen && (
                  <div className="as-user-popover">
                    <div className="as-user-popover__head">
                      <div className="as-user-av as-user-av--lg" aria-hidden="true">{userInitials(user)}</div>
                      <div>
                        <b>{user?.full_name ?? "Süper Admin"}</b>
                        <span>{user?.email ?? ""}</span>
                        <em>{roleLabel}</em>
                      </div>
                    </div>
                    <button type="button" onClick={handleProfileClick} className="as-user-popover-btn">
                      👤 Profilim
                    </button>
                    <button type="button" onClick={handleSettingsClick} className="as-user-popover-btn">
                      ⚙️ Hesap Ayarları
                    </button>
                    <div className="as-user-popover__sep" />
                    <button type="button" onClick={handleLogout} className="as-user-popover-btn as-user-popover-btn--logout">
                      🚪 Çıkış Yap
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="as-page">
            {children}
          </div>
        </div>
      </div>
    </div>
    {menuOpen     && <div onClick={() => setMenuOpen(false)}     className="as-overlay" />}
    {mailMenuOpen && <div onClick={() => setMailMenuOpen(false)} className="as-overlay" />}
    {notifOpen    && <div onClick={() => setNotifOpen(false)}    className="as-overlay" />}
    <MailCenterPopup isOpen={mailPopupOpen} initialAccountId={mailPopupAccountId} onClose={() => setMailPopupOpen(false)} />
    </>
  );
}
