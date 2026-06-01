import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  Briefcase,
  Building,
  Building2,
  CheckSquare,
  FileBarChart,
  FlaskConical,
  FolderOpen,
  Handshake,
  HelpCircle,
  Home,
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
} from "lucide-react";
import type { AuthUser } from "../../context/auth-types";
import { ADMIN_NAV_GROUPS, navLabelForKey } from "./adminNav";
import PublicBrandLogo from "../../components/PublicBrandLogo";
import "./adminShell.css";

type AdminShellProps = {
  activeKey: string;
  onNavigate: (key: string) => void;
  user: AuthUser | null;
  children: ReactNode;
};

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
    case "building":  return <Building {...props} />;
    case "shield":    return <Shield {...props} />;
    case "grid":      return <LayoutGrid {...props} />;
    case "users":     return <Users {...props} />;
    case "folder":    return <FolderOpen {...props} />;
    case "check":     return <CheckSquare {...props} />;
    case "report":    return <FileBarChart {...props} />;
    case "help":      return <HelpCircle {...props} />;
    case "palette":   return <Palette {...props} />;
    case "sliders":   return <SlidersHorizontal {...props} />;
    default:          return <Home {...props} />;
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

function userInitials(user: AuthUser | null): string {
  if (!user) return "SA";
  const name = user.full_name?.trim() || user.email;
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function AdminShell({ activeKey, onNavigate, user, children }: AdminShellProps) {
  const activeLabel = navLabelForKey(activeKey);

  return (
    <div className="as-shell">
      {/* ── SIDEBAR ── */}
      <aside className="as-sidebar">
        <div className="as-brand">
          <div className="as-brand-row">
            <PublicBrandLogo height={26} maxWidth={130} invert />
            <span className="as-brand-tag">SÜPER ADMİN</span>
          </div>
          <div className="as-tenant">
            <div className="as-tenant-avatar">BA</div>
            <div>
              <div className="as-tenant-name">Buyer Asistans</div>
              <div className="as-tenant-role">Platform Süper Admin</div>
            </div>
          </div>
        </div>

        <nav aria-label="Yönetim menüsü">
          {ADMIN_NAV_GROUPS.map((group) => (
            <div key={group.label} className="as-nav-group">
              <h4>{group.label}</h4>
              {group.items.map((item) => {
                const isActive = item.key === activeKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`as-nav-item${isActive ? " as-nav-item--active" : ""}`}
                    onClick={() => onNavigate(item.key)}
                    aria-current={isActive ? "page" : undefined}
                    title={item.label}
                  >
                    <span className="as-nav-ico">
                      <NavIcon name={item.icon} />
                    </span>
                    <span className="as-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className="as-nav-pill">{item.badge}</span>
                    )}
                    {item.alert && !item.badge && (
                      <span className="as-nav-pill as-nav-pill--alert">!</span>
                    )}
                    {item.count != null && (
                      <span className="as-nav-pill as-nav-pill--muted">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="as-sidebar-footer">
          <span>buyerasistans.com.tr</span>
          <span className="as-health-dot">● Sağlıklı</span>
        </div>
      </aside>

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
            <span className="as-lang-pill" aria-label="Dil: Türkçe">🇹🇷 TR</span>
            <button type="button" className="as-icon-btn" aria-label="Bildirimler">
              <Bell size={16} />
            </button>
            <button type="button" className="as-icon-btn" aria-label="Mesajlar">
              <Mail size={16} />
            </button>
            <div className="as-user-chip" aria-label={`Kullanıcı: ${user?.full_name ?? user?.email ?? "Süper Admin"}`}>
              <div className="as-user-av" aria-hidden="true">
                {userInitials(user)}
              </div>
              <div className="as-user-meta">
                <b>{user?.full_name ?? "Süper Admin"}</b>
                <span>{user?.email ?? ""}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="as-page">
          {children}
        </div>
      </div>
    </div>
  );
}
