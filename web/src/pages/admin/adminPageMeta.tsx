import { BarChart3, Blocks, Brain, Building, Building2, Compass, FlaskConical, FolderKanban, Globe2, Handshake, KeyRound, LayoutPanelTop, LifeBuoy, Mail, Megaphone, Package, Settings2, Shield, Users, Wrench } from "lucide-react";
import "./adminPageMeta.css";

export type AdminTabKey =
  | "panel_home"
  | "panel_designer"
  | "platform_overview"
  | "platform_operations"
  | "discovery_lab_operations"
  | "onboarding_studio"
  | "tenant_governance"
  | "packages"
  | "deployment"
  | "platform_analytics"
  | "platform_suppliers"
  | "public_pricing"
  | "campaigns"
  | "commission_admin"
  | "support_tickets"
  | "kariyer_yonetimi"
  | "companies"
  | "roles"
  | "departments"
  | "personnel"
  | "projects"
  | "suppliers"
  | "approvals"
  | "reports"
  | "mail"
  | "settings"
  | "supplier_profile"
  | "channel_partners"
  | "ai_lab"
  | "talent_ecosystem"
  | "nav_management";

export type TabConfig = {
  key: AdminTabKey;
  label: string;
  icon: string;
  description: string;
};

export type AdminFocusBannerTone = "teal" | "blue" | "violet" | "amber";

function renderTabIcon(icon: string, active = false) {
  const commonProps = {
    size: 16,
    strokeWidth: 2.2,
    color: active ? "#ffffff" : "#334155",
  };

  switch (icon) {
    case "ADM":
    case "ROL":
      return <Shield {...commonProps} />;
    case "FRM":
      return <Building2 {...commonProps} />;
    case "DEP":
      return <Building {...commonProps} />;
    case "PRS":
      return <Wrench {...commonProps} />;
    case "PRJ":
      return <FolderKanban {...commonProps} />;
    case "TDK":
    case "TED":
      return <Handshake {...commonProps} />;
    case "ONY":
      return <KeyRound {...commonProps} />;
    case "RPR":
    case "ANL":
      return <BarChart3 {...commonProps} />;
    case "AYR":
      return <Settings2 {...commonProps} />;
    case "EML":
      return <Mail {...commonProps} />;
    case "PNT":
      return <LayoutPanelTop {...commonProps} />;
    case "GEN":
      return <Compass {...commonProps} />;
    case "OPS":
      return <Wrench {...commonProps} />;
    case "LAB":
      return <FlaskConical {...commonProps} />;
    case "KUR":
      return <Blocks {...commonProps} />;
    case "SPY":
      return <Building2 {...commonProps} />;
    case "PKT":
      return <Package {...commonProps} />;
    case "DPL":
      return <Globe2 {...commonProps} />;
    case "FYT":
      return <Package {...commonProps} />;
    case "KMP":
      return <Megaphone {...commonProps} />;
    case "DST":
      return <LifeBuoy {...commonProps} />;
    case "KNL":
      return <Users {...commonProps} />;
    case "AIC":
      return <Brain {...commonProps} />;
    default:
      return <Globe2 {...commonProps} />;
  }
}

export function renderTabIconBadge(icon: string, active = false) {
  return (
    <span
      className={`admin-tab-icon-badge ${active ? "admin-tab-icon-badge--active" : "admin-tab-icon-badge--inactive"}`}
    >
      {renderTabIcon(icon, active)}
    </span>
  );
}

export function translateServiceLabel(label: string) {
  const normalized = String(label || "").trim().toLowerCase();
  if (normalized === "rfq core") return "RFQ (Teklif Isteme Formu)";
  if (normalized === "rfq (teklif isteme formu) yonetimi") return "RFQ (Teklif İsteme Formu) Yönetimi";
  if (normalized === "advanced reports") return "Gelismis Raporlar";
  if (normalized === "supplier portal") return "Tedarikçi Portalı";
  if (normalized === "tedarikci portali") return "Tedarikçi Portalı";
  if (normalized === "active private supplier" || normalized === "aktif ozel tedarikci") return "Tedarikçi Portalı";
  if (normalized === "active project" || normalized === "aktif proje" || normalized === "project management" || normalized === "proje yonetimi") return "Proje Yönetimi";
  if (normalized === "active user" || normalized === "aktif kullanici" || normalized === "user management" || normalized === "kullanici yonetimi") return "Kullanıcı Yönetimi";
  if (normalized === "project limit") return "Proje Yönetimi";
  if (normalized === "user limit") return "Kullanıcı Yönetimi";
  if (normalized === "project file upload" || normalized === "proje dosya yukleme") return "Proje Dosya Yukleme";
  if (normalized === "project file size" || normalized === "proje dosya boyutu" || normalized === "maksimum dosya boyutu") return "Maksimum Dosya Boyutu";
  return label;
}

export const adminFocusBannerPalette: Record<AdminFocusBannerTone, { border: string; background: string; accent: string; soft: string }> = {
  teal: { border: "#99f6e4", background: "#f0fdfa", accent: "#0f766e", soft: "#ccfbf1" },
  blue: { border: "#93c5fd", background: "#eff6ff", accent: "#1d4ed8", soft: "#dbeafe" },
  violet: { border: "#c4b5fd", background: "#f5f3ff", accent: "#6d28d9", soft: "#ede9fe" },
  amber: { border: "#fcd34d", background: "#fffbeb", accent: "#b45309", soft: "#fef3c7" },
};
