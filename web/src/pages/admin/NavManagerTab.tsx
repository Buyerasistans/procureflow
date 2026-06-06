import { useState, useMemo } from "react";
import {
  BarChart3, Briefcase, Building, Building2, CheckSquare,
  FileBarChart, FlaskConical, FolderOpen, Handshake, HelpCircle,
  Home, LayoutGrid, Link2, Megaphone, Package, Palette, Rocket,
  Settings2, Shield, SlidersHorizontal, Tag, TrendingUp,
  Users, Wallet,
} from "lucide-react";
import { ADMIN_NAV_GROUPS } from "./adminNav";
import "./navManagerTab.css";

// ─── types ──────────────────────────────────────────────────
type NmVis = "show" | "lock" | "hide";
type NmPlacement = "top" | "side" | "both" | "hidden";
type NmItemConfig = { placement: NmPlacement; enabled: boolean; roles: Record<string, NmVis> };
type NmConfig = {
  layoutMode: "single" | "top" | "dual";
  menuStyle: "expanded" | "dropdown";
  order: string[];
  items: Record<string, NmItemConfig>;
};
type NmFlatItem = { key: string; label: string; icon: string; group: string; tenant?: boolean };

// ─── constants ──────────────────────────────────────────────
const NM_ROLES = [
  { key: "super_admin",       label: "Süper Admin",        cat: "Platform" },
  { key: "platform_support",  label: "Platform Destek",    cat: "Platform" },
  { key: "platform_operator", label: "Platform Operasyon", cat: "Platform" },
  { key: "finance_officer",   label: "Finans",             cat: "Platform" },
  { key: "tenant_admin",      label: "Partner Admin",      cat: "Stratejik Partner" },
  { key: "tenant_member",     label: "Partner Üye",        cat: "Stratejik Partner" },
  { key: "channel_agent",     label: "Kanal İş Ortağı",    cat: "Kanal" },
  { key: "supplier_user",     label: "Tedarikçi",          cat: "Tedarikçi" },
] as const;

const NM_ALLOWED: Record<string, string[] | "*"> = {
  super_admin:       "*",
  platform_support:  ["panel_home", "platform_overview", "platform_operations", "companies", "personnel", "reports", "support_tickets", "settings"],
  platform_operator: ["panel_home", "platform_overview", "platform_operations", "onboarding_studio", "tenant_governance", "platform_suppliers", "deployment"],
  finance_officer:   ["panel_home", "platform_overview", "packages", "public_pricing", "commission_admin", "reports"],
  tenant_admin:      ["panel_home", "companies", "roles", "departments", "personnel", "projects", "approvals", "reports", "settings"],
  tenant_member:     ["panel_home", "projects", "reports"],
  channel_agent:     ["panel_home", "channel_partners", "commission_admin", "reports"],
  supplier_user:     ["panel_home"],
};

const NM_DEFAULT_PLACEMENT: Record<string, NmPlacement> = {
  panel_home: "both", platform_analytics: "top", kariyer_yonetimi: "top",
  public_pricing: "top", campaigns: "top", reports: "both",
};

const NM_TENANT_ITEMS: NmFlatItem[] = [
  { key: "tnt_dashboard",   label: "Dashboard",      icon: "home",      group: "Tenant Üst Menü", tenant: true },
  { key: "tnt_teklifler",   label: "Teklifler",      icon: "report",    group: "Tenant Üst Menü", tenant: true },
  { key: "tnt_yonetim",     label: "Yönetim Alanı",  icon: "grid",      group: "Tenant Üst Menü", tenant: true },
  { key: "tnt_ai_lab",      label: "AI Keşif Lab",   icon: "lab",       group: "Tenant Üst Menü", tenant: true },
  { key: "tnt_raporlar",    label: "Raporlar",       icon: "report",    group: "Tenant Üst Menü", tenant: true },
  { key: "tnt_is_ilanlari", label: "İş İlanları",    icon: "briefcase", group: "Tenant Üst Menü", tenant: true },
];

const NM_TENANT_ALLOWED: Record<string, string[]> = {
  super_admin:       [],
  platform_support:  [],
  platform_operator: [],
  finance_officer:   [],
  tenant_admin:      ["tnt_dashboard", "tnt_teklifler", "tnt_yonetim", "tnt_ai_lab", "tnt_raporlar", "tnt_is_ilanlari"],
  tenant_member:     ["tnt_dashboard", "tnt_teklifler", "tnt_raporlar", "tnt_is_ilanlari"],
  channel_agent:     ["tnt_dashboard", "tnt_teklifler", "tnt_raporlar"],
  supplier_user:     ["tnt_dashboard", "tnt_teklifler"],
};

const NM_PLACEMENTS: Array<{ v: NmPlacement; l: string }> = [
  { v: "top",    l: "Üst"  },
  { v: "side",   l: "Sol"  },
  { v: "both",   l: "İkisi"},
  { v: "hidden", l: "Gizli"},
];

const NM_VIS_META: Record<NmVis, { l: string; sym: string; cls: string }> = {
  show: { l: "Göster", sym: "✓",  cls: "show" },
  lock: { l: "Kilitli", sym: "🔒", cls: "lock" },
  hide: { l: "Gizli",  sym: "–",  cls: "hide" },
};

// ─── helpers ────────────────────────────────────────────────
function nmFlatItems(): NmFlatItem[] {
  const out: NmFlatItem[] = [];
  ADMIN_NAV_GROUPS.forEach((g) =>
    g.items.forEach((it) => out.push({ key: it.key, label: it.label, icon: it.icon, group: g.label }))
  );
  NM_TENANT_ITEMS.forEach((it) => out.push({ ...it }));
  return out;
}

function nmBuildDefault(): NmConfig {
  const items = nmFlatItems();
  const cfgItems: Record<string, NmItemConfig> = {};
  items.forEach((it) => {
    const roles: Record<string, NmVis> = {};
    NM_ROLES.forEach((r) => {
      if (it.tenant) {
        roles[r.key] = (NM_TENANT_ALLOWED[r.key] || []).includes(it.key) ? "show" : "hide";
      } else {
        const allowed = NM_ALLOWED[r.key];
        roles[r.key] = allowed === "*" || (Array.isArray(allowed) && allowed.includes(it.key)) ? "show" : "hide";
      }
    });
    cfgItems[it.key] = {
      placement: it.tenant ? "top" : (NM_DEFAULT_PLACEMENT[it.key] || "side"),
      enabled: true,
      roles,
    };
  });
  return { layoutMode: "single", menuStyle: "expanded", order: items.map((i) => i.key), items: cfgItems };
}

function nmReadSaved(): NmConfig {
  const def = nmBuildDefault();
  try {
    const s = localStorage.getItem("pf_nav_config");
    if (s) {
      const saved = JSON.parse(s) as NmConfig;
      if (saved?.items) {
        def.order.forEach((k) => {
          if (!saved.items[k]) saved.items[k] = def.items[k];
          if (!saved.order.includes(k)) saved.order.push(k);
        });
        if (!saved.layoutMode) saved.layoutMode = def.layoutMode;
        return saved;
      }
    }
  } catch { /* ignore */ }
  return def;
}

// ─── icon renderer ──────────────────────────────────────────
function NmIcon({ name, size = 14 }: { name: string; size?: number }) {
  const p = { size, strokeWidth: 2.2 } as const;
  switch (name) {
    case "home":      return <Home {...p} />;
    case "chart":     return <BarChart3 {...p} />;
    case "analytics": return <TrendingUp {...p} />;
    case "lab":       return <FlaskConical {...p} />;
    case "cog":       return <Settings2 {...p} />;
    case "partner":   return <Building2 {...p} />;
    case "supplier":  return <Handshake {...p} />;
    case "rocket":    return <Rocket {...p} />;
    case "briefcase": return <Briefcase {...p} />;
    case "package":   return <Package {...p} />;
    case "price":     return <Tag {...p} />;
    case "megaphone": return <Megaphone {...p} />;
    case "wallet":    return <Wallet {...p} />;
    case "link":      return <Link2 {...p} />;
    case "building":  return <Building {...p} />;
    case "shield":    return <Shield {...p} />;
    case "grid":      return <LayoutGrid {...p} />;
    case "users":     return <Users {...p} />;
    case "folder":    return <FolderOpen {...p} />;
    case "check":     return <CheckSquare {...p} />;
    case "report":    return <FileBarChart {...p} />;
    case "help":      return <HelpCircle {...p} />;
    case "palette":   return <Palette {...p} />;
    case "sliders":   return <SlidersHorizontal {...p} />;
    default:          return <Home {...p} />;
  }
}

// ─── component ──────────────────────────────────────────────
export default function NavManagerTab() {
  const itemsMeta = useMemo(nmFlatItems, []);
  const metaByKey = useMemo(() => Object.fromEntries(itemsMeta.map((i) => [i.key, i])), [itemsMeta]);

  const [cfg, setCfg] = useState<NmConfig>(nmReadSaved);
  const [role, setRole] = useState("super_admin");
  const [dirty, setDirty] = useState(false);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  function mutate(fn: (n: NmConfig) => void) {
    setCfg((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as NmConfig;
      fn(next);
      return next;
    });
    setDirty(true);
  }
  function setPlacement(key: string, v: NmPlacement) { mutate((n) => { n.items[key].placement = v; }); }
  function toggleEnabled(key: string) {
    if (key === "panel_home") return;
    mutate((n) => { n.items[key].enabled = !n.items[key].enabled; });
  }
  function cycleVis(key: string, rk: string) {
    if (key === "panel_home") return;
    mutate((n) => {
      const cur = n.items[key].roles[rk];
      n.items[key].roles[rk] = cur === "show" ? "lock" : cur === "lock" ? "hide" : "show";
    });
  }
  function setLayout(mode: NmConfig["layoutMode"]) { mutate((n) => { n.layoutMode = mode; }); }
  function setMenuStyle(s: NmConfig["menuStyle"]) { mutate((n) => { n.menuStyle = s; }); }

  function save() {
    try {
      localStorage.setItem("pf_nav_config", JSON.stringify(cfg));
      window.dispatchEvent(new Event("navcfgchange"));
    } catch { /* ignore */ }
    setDirty(false);
  }
  function reset() {
    if (!confirm("Navigasyon ayarları varsayılana sıfırlanacak. Emin misin?")) return;
    setCfg(nmBuildDefault());
    setDirty(false);
  }
  function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) { setDragKey(null); setOverKey(null); return; }
    mutate((n) => {
      const arr = n.order.filter((k) => k !== dragKey);
      const idx = arr.indexOf(targetKey);
      arr.splice(idx, 0, dragKey!);
      n.order = arr;
    });
    setDragKey(null); setOverKey(null);
  }

  const sideOnly = cfg.layoutMode === "single";
  const topOnly  = cfg.layoutMode === "top";
  const vis = (key: string): NmVis => cfg.items[key]?.roles[role] ?? "hide";

  const topPrev = cfg.order.filter((k) => {
    const it = cfg.items[k]; if (!it?.enabled || it.placement === "hidden") return false;
    if (vis(k) === "hide") return false;
    if (sideOnly) return false;
    if (topOnly)  return true;
    return it.placement === "top" || it.placement === "both";
  });
  const sidePrev = cfg.order.filter((k) => {
    const it = cfg.items[k]; if (!it?.enabled || it.placement === "hidden") return false;
    if (vis(k) === "hide") return false;
    if (topOnly) return false;
    if (sideOnly) return true;
    return it.placement === "side" || it.placement === "both";
  });

  // Group top-nav items by their group label
  const topGroups: Array<{ label: string; items: string[] }> = [];
  const seenG: Record<string, { label: string; items: string[] }> = {};
  topPrev.forEach((k) => {
    const g = metaByKey[k]?.group ?? "Diğer";
    if (!seenG[g]) { seenG[g] = { label: g, items: [] }; topGroups.push(seenG[g]); }
    seenG[g].items.push(k);
  });

  const modeLabel = sideOnly ? "tek nav (sol)" : topOnly ? "tek nav (üst)" : "ikili nav";
  const currentRole = NM_ROLES.find((r) => r.key === role);

  return (
    <div className="nm-root">
      {/* ── PageHeader ── */}
      <div className="nm-header">
        <div className="nm-header__text">
          <span className="nm-header__eyebrow">Sistem · Navigasyon</span>
          <h1 className="nm-header__title">Navigasyon Yönetimi</h1>
          <p className="nm-header__sub">
            Her nav butonunun yerleşimini (üst / sol), sırasını ve rol bazlı görünürlüğünü (göster · kilitle · gizle) tek panelden yönet.
          </p>
        </div>
        <div className="nm-header__actions">
          <button type="button" className="nm-btn nm-btn--ghost" onClick={reset}>Varsayılana sıfırla</button>
          <button type="button" className="nm-btn nm-btn--primary" onClick={save} disabled={!dirty}>
            {dirty ? "● Kaydet ve Yayınla" : "✓ Kaydedildi"}
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="nm-toolbar">
        <div className="nm-toolbar__field">
          <span>Düzen modu</span>
          <div className="nm-seg">
            {(["single", "top", "dual"] as const).map((v) => (
              <button key={v} type="button" className={cfg.layoutMode === v ? "on" : ""} onClick={() => setLayout(v)}>
                {v === "single" ? "Tek (sol)" : v === "top" ? "Tek (üst)" : "İkili"}
              </button>
            ))}
          </div>
        </div>
        <div className="nm-toolbar__field">
          <span>Menü stili</span>
          <div className="nm-seg">
            {(["expanded", "dropdown"] as const).map((v) => (
              <button key={v} type="button" className={cfg.menuStyle === v ? "on" : ""} onClick={() => setMenuStyle(v)}>
                {v === "expanded" ? "Sabit (açık)" : "Açılır menü"}
              </button>
            ))}
          </div>
        </div>
        <div className="nm-toolbar__field">
          <span>Önizlenen rol</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {NM_ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </div>
        <div className="nm-toolbar__note">
          {cfg.layoutMode === "dual"
            ? "İkili düzen: «İkisi» işaretli öğeler hem üstte hem solda görünür."
            : cfg.layoutMode === "top"
              ? "Tek üst: tüm görünür öğeler üst menüde toplanır. Sol nav gizlenir."
              : "Tek sol: tüm görünür öğeler sol menüde toplanır. Üst nav gizlenir."}
        </div>
      </div>

      {/* ── Main grid: list + preview ── */}
      <div className="nm-grid">
        {/* Left: item list */}
        <section className="nm-panel">
          <div className="nm-panel__head">
            <h2>Nav Öğeleri</h2>
            <span>Sürükleyerek sırala · yerleşim ve aç/kapa</span>
          </div>
          <div className="nm-list">
            {cfg.order.map((key) => {
              const m = metaByKey[key]; if (!m) return null;
              const it = cfg.items[key];
              return (
                <div
                  key={key}
                  className={`nm-row${overKey === key ? " nm-row--over" : ""}${!it.enabled ? " nm-row--off" : ""}`}
                  draggable
                  onDragStart={() => setDragKey(key)}
                  onDragOver={(e) => { e.preventDefault(); setOverKey(key); }}
                  onDragLeave={() => setOverKey((k) => k === key ? null : k)}
                  onDrop={() => onDrop(key)}
                >
                  <span className="nm-row__grip" title="Sürükle">⠿</span>
                  <span className="nm-row__ico"><NmIcon name={m.icon} size={14} /></span>
                  <div className="nm-row__meta">
                    <b>{m.label}</b>
                    <span>{m.group}</span>
                  </div>
                  <div className="nm-seg nm-seg--sm">
                    {NM_PLACEMENTS.map((p) => (
                      <button
                        key={p.v}
                        type="button"
                        className={it.placement === p.v ? "on" : ""}
                        onClick={() => setPlacement(key, p.v)}
                      >{p.l}</button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`nm-switch${it.enabled ? " nm-switch--on" : ""}`}
                    onClick={() => toggleEnabled(key)}
                    disabled={key === "panel_home"}
                    title={key === "panel_home" ? "Ana sayfa kapatılamaz" : (it.enabled ? "Açık" : "Kapalı")}
                  >
                    <span />
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: live preview */}
        <section className="nm-panel nm-panel--sticky">
          <div className="nm-panel__head">
            <h2>Canlı Önizleme</h2>
            <span>{currentRole?.label} · {modeLabel}</span>
          </div>
          <div className="nm-preview">
            {!sideOnly && (
              <div className="nm-pv-top">
                <div className="nm-pv-top__brand">BA</div>
                {topPrev.length === 0
                  ? <span className="nm-pv-empty">Üst nav boş — öğeleri «Üst» ya da «İkisi» yap</span>
                  : topGroups.map((g) => (
                      <div key={g.label} className="nm-pv-topgroup">
                        <div className="nm-pv-topgroup__hd">{g.label} <span>▾</span></div>
                        <div className="nm-pv-topgroup__items">
                          {g.items.map((k) => (
                            <span key={k} className={`nm-pv-pill${vis(k) === "lock" ? " nm-pv-pill--locked" : ""}`}>
                              {metaByKey[k]?.label}{vis(k) === "lock" ? " 🔒" : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                }
              </div>
            )}
            <div className="nm-pv-body">
              {!topOnly && (
                <div className="nm-pv-side">
                  <div className="nm-pv-side__brand">
                    <b>BUYER</b><span>{sideOnly ? "TEK NAV" : "SOL NAV"}</span>
                  </div>
                  {sidePrev.map((k) => (
                    <div
                      key={k}
                      className={`nm-pv-navitem${vis(k) === "lock" ? " nm-pv-navitem--locked" : ""}${k === "panel_home" ? " nm-pv-navitem--active" : ""}`}
                    >
                      <NmIcon name={metaByKey[k]?.icon ?? "home"} size={12} />
                      <span>{metaByKey[k]?.label}</span>
                      {vis(k) === "lock" && <span className="nm-pv-lock">🔒</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="nm-pv-content">
                <div className="nm-pv-line" />
                <div className="nm-pv-line nm-pv-line--sm" />
                <div className="nm-pv-cards"><span /><span /><span /></div>
              </div>
            </div>
          </div>
          <div className="nm-legend">
            <span><i className="nm-dot nm-dot--show" />Göster</span>
            <span><i className="nm-dot nm-dot--lock" />Kilitli (görünür, tıklanamaz)</span>
            <span><i className="nm-dot nm-dot--hide" />Gizli</span>
          </div>
        </section>
      </div>

      {/* ── Rol × Öğe Matrisi ── */}
      <div className="nm-matrix-section">
        <div className="nm-matrix-section__head">
          <h2>Rol × Öğe Görünürlüğü</h2>
          <span>Hücreye tıkla: Göster → Kilitle → Gizle. Her rol (süper admin dahil) bağımsız ayarlanır; Panel Ana Sayfa kapatılamaz.</span>
        </div>
        <div className="nm-matrix-wrap">
          <table className="nm-matrix">
            <thead>
              <tr>
                <th className="nm-matrix__corner">Nav Öğesi</th>
                {NM_ROLES.map((r) => <th key={r.key} title={r.cat}>{r.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {cfg.order.map((key) => {
                const m = metaByKey[key]; if (!m) return null;
                return (
                  <tr key={key}>
                    <td className="nm-matrix__row">
                      <NmIcon name={m.icon} size={12} />
                      <span>{m.label}</span>
                    </td>
                    {NM_ROLES.map((r) => {
                      const v: NmVis = cfg.items[key]?.roles[r.key] ?? "hide";
                      const meta = NM_VIS_META[v];
                      const locked = key === "panel_home";
                      return (
                        <td key={r.key} className="nm-matrix__cell">
                          <button
                            type="button"
                            className={`nm-cell nm-cell--${meta.cls}${locked ? " nm-cell--fixed" : ""}`}
                            onClick={() => !locked && cycleVis(key, r.key)}
                            title={meta.l}
                          >{meta.sym}</button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
