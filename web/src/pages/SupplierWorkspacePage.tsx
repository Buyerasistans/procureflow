import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getSupplierAccessToken } from "../lib/session";
import { panelProfileCssVars, pdChromeBg } from "../admin/panel-designer.helpers";
import { Archive, Award, Bell, Building2, FileCheck, FileText, FolderOpen, Home, LogOut, Mail, Menu, Settings2, ShieldCheck, Users } from "lucide-react";
import PublicBrandLogo from "../components/PublicBrandLogo";
import LanguageSwitcher from "../components/LanguageSwitcher";
import {
  getSupplierProfile,
  listSupplierContracts,
  listSupplierDocuments,
  listSupplierGuarantees,
  uploadSupplierDocument,
  type SupplierContractItem,
  type SupplierDocCategory,
  type SupplierDocumentItem,
  type SupplierGuaranteeItem,
  type SupplierProfileResponse,
} from "../services/supplier-profile.service";
import { SupplierResponsePortal } from "../components/SupplierResponsePortal";
import "./SupplierDashboard.css";
import "./SupplierWorkspacePage.css";

type WorkspaceTab = "profile" | "offers" | "contracts" | "guarantees" | SupplierDocCategory;

const DOC_TABS: SupplierDocCategory[] = ["certificates", "company_docs", "personnel_docs", "guarantee_docs"];

const TAB_LABELS: Record<WorkspaceTab, string> = {
  profile: "Profilim",
  offers: "Tekliflerim",
  contracts: "Sözleşmelerim",
  guarantees: "Teminatlarım",
  certificates: "Sertifikalar",
  company_docs: "Şirket Evrakları",
  personnel_docs: "Personel Evrakları",
  guarantee_docs: "Alınan Teminatlar",
};

function isDocTab(tab: WorkspaceTab): tab is SupplierDocCategory {
  return DOC_TABS.includes(tab as SupplierDocCategory);
}

function getInitialTab(search: string): WorkspaceTab {
  const value = new URLSearchParams(search).get("tab");
  const validTabs: WorkspaceTab[] = ["profile", "offers", "contracts", "guarantees", ...DOC_TABS];
  if (value && validTabs.includes(value as WorkspaceTab)) {
    return value as WorkspaceTab;
  }
  return "profile";
}

const SUPPLIER_PANEL = { color: "#0c4a6e", color2: "#38bdf8", color2Mix: 0.22, accent: "#0E7490", textColor: "#f0f9ff" } as const;

export default function SupplierWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<WorkspaceTab>(() => getInitialTab(location.search));
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [profile, setProfile] = useState<SupplierProfileResponse | null>(null);
  const [documents, setDocuments] = useState<SupplierDocumentItem[]>([]);
  const [contracts, setContracts] = useState<SupplierContractItem[]>([]);
  const [guarantees, setGuarantees] = useState<SupplierGuaranteeItem[]>([]);

  const [fileNameFilter, setFileNameFilter] = useState("");
  const [docFromDate, setDocFromDate] = useState("");
  const [docToDate, setDocToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Sidebar identity
  const [sidebarFirmName, setSidebarFirmName] = useState("Tedarikçi Firması");
  const [sidebarFirmLogoUrl, setSidebarFirmLogoUrl] = useState<string | null>(null);
  const [sidebarUserName, setSidebarUserName] = useState("-");
  const [sidebarUserRole, setSidebarUserRole] = useState("Tedarikçi");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const flash = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Apply supplier panel design system CSS vars to wrap container
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.setAttribute("data-panel", "supplier");
    const vars = panelProfileCssVars(SUPPLIER_PANEL);
    for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
    el.style.setProperty("--panel-chrome-hero", pdChromeBg("hero", SUPPLIER_PANEL.color, SUPPLIER_PANEL.color2, SUPPLIER_PANEL.color2Mix));
  }, []);

  // Load sidebar profile identity on mount
  useEffect(() => {
    void (async () => {
      try {
        const p = await getSupplierProfile();
        setSidebarFirmName(p.supplier.company_name || "Tedarikçi Firması");
        const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace("/api/v1", "") || "";
        if (p.supplier.logo_url) {
          setSidebarFirmLogoUrl(p.supplier.logo_url.startsWith("http") ? p.supplier.logo_url : base + p.supplier.logo_url);
        }
        setSidebarUserName(p.user.name || p.user.email || "-");
        const rawUser = localStorage.getItem("pf_user") || sessionStorage.getItem("pf_user");
        if (rawUser) {
          const parsed = JSON.parse(rawUser) as { business_role?: string; role_profile_code?: string };
          const br = String(parsed.business_role || "").toLowerCase();
          setSidebarUserRole(parsed.role_profile_code || (br === "supplier_admin" ? "Tedarikçi Yöneticisi" : "Tedarikçi Kullanıcısı"));
        }
      } catch { /* sidebar uses defaults */ }
    })();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("supplier_access_token");
    sessionStorage.removeItem("supplier_access_token");
    navigate("/supplier/login", { replace: true });
  };

  useEffect(() => {
    if (!getSupplierAccessToken()) {
      navigate("/supplier/login", { replace: true });
      return;
    }
    setTab(getInitialTab(location.search));
  }, [location.search, navigate]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        if (tab === "profile") {
          setProfile(await getSupplierProfile());
        } else if (isDocTab(tab)) {
          setDocuments(await listSupplierDocuments(tab));
        } else if (tab === "contracts") {
          setContracts(await listSupplierContracts());
        } else if (tab === "guarantees") {
          setGuarantees(await listSupplierGuarantees());
        }
      } catch {
        flash("Veriler yüklenemedi", "error");
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [tab]);

  const changeTab = (next: WorkspaceTab) => {
    navigate(`/supplier/workspace?tab=${next}`);
  };

  const inDateRange = (value: string | undefined, fromDate: string, toDate: string) => {
    if (!fromDate && !toDate) return true;
    if (!value) return false;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    if (fromDate && d < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && d > new Date(`${toDate}T23:59:59`)) return false;
    return true;
  };

  const filteredDocuments = useMemo(
    () => documents.filter((d) => {
      const nameOk = !fileNameFilter.trim() || d.original_filename.toLowerCase().includes(fileNameFilter.trim().toLowerCase());
      const dateOk = inDateRange(d.created_at, docFromDate, docToDate);
      return nameOk && dateOk;
    }),
    [documents, fileNameFilter, docFromDate, docToDate]
  );

  const filteredContracts = useMemo(
    () => contracts.filter((c) => statusFilter === "all" || c.status === statusFilter),
    [contracts, statusFilter]
  );

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isDocTab(tab)) return;
    try {
      setUploading(true);
      await uploadSupplierDocument(tab, file);
      setDocuments(await listSupplierDocuments(tab));
      flash("Evrak yüklendi", "success");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Evrak yüklenemedi";
      flash(msg, "error");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const openDocument = async (doc: SupplierDocumentItem) => {
    const token = getSupplierAccessToken();
    if (!token) { flash("Oturum bulunamadı", "error"); return; }
    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000";
    try {
      const response = await fetch(`${apiBase}${doc.file_url}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      flash("Doküman açılamadı", "error");
    }
  };

  return (
    <div className="sds-wrap" ref={wrapRef}>

      {/* ── ROW 1: Full-width dark primary topbar ── */}
      <header className="sds-panel-top">
        <div className="sds-pt-brand">
          <button type="button" className="sds-hamburger" onClick={() => setSidebarOpen((p) => !p)} aria-label="Menüyü aç">
            <Menu size={18} />
          </button>
          <PublicBrandLogo height={44} maxWidth={160} invert />
        </div>
        <div className="sds-pt-center">
          <div className="sds-pt-title-row">
            <span className="sds-pt-platform">Tedarikçi Yönetim Paneli</span>
            <span className="sds-pt-dot">·</span>
            <span className="sds-pt-title">{sidebarUserRole}</span>
            <span className="sds-pt-ver">v3.4</span>
          </div>
        </div>
        <div className="sds-pt-welcome">
          <span className="sds-pt-hi">Hoş geldiniz</span>
          <b className="sds-pt-name">{sidebarUserName}</b>
        </div>
      </header>

      {/* ── ROW 2: Shell (sidebar + main) ── */}
      <div className="sds-shell">

        {sidebarOpen && <div className="sds-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* ── SIDEBAR ── */}
        <aside className={`sds-sidebar${sidebarOpen ? " sds-sidebar--open" : ""}`}>

          <div className="sds-tenant-block">
            {sidebarFirmLogoUrl
              ? <img className="sds-tenant-avatar__img" src={sidebarFirmLogoUrl} alt={sidebarFirmName} />
              : <div className="sds-tenant-avatar">{sidebarFirmName.slice(0, 2).toUpperCase()}</div>
            }
            <div>
              <div className="sds-tenant-name">{sidebarFirmName}</div>
              <div className="sds-tenant-role">{sidebarUserRole}</div>
            </div>
          </div>

          <nav className="sds-nav">
            <div className="sds-nav-group">
              <div className="sds-nav-group-label">GENEL</div>
              <button type="button" className="sds-nav-item" onClick={() => { navigate("/supplier/dashboard"); setSidebarOpen(false); }}>
                <Home size={15} /> Anasayfa
              </button>
            </div>

            <div className="sds-nav-group">
              <div className="sds-nav-group-label">İŞ AKIŞI</div>
              <button type="button" className={`sds-nav-item${tab === "offers" ? " sds-nav-item--active" : ""}`} onClick={() => { changeTab("offers"); setSidebarOpen(false); }}>
                <FileText size={15} /> Tekliflerim
              </button>
              <button type="button" className={`sds-nav-item${tab === "contracts" ? " sds-nav-item--active" : ""}`} onClick={() => { changeTab("contracts"); setSidebarOpen(false); }}>
                <FileCheck size={15} /> Sözleşmelerim
              </button>
              <button type="button" className={`sds-nav-item${tab === "guarantees" ? " sds-nav-item--active" : ""}`} onClick={() => { changeTab("guarantees"); setSidebarOpen(false); }}>
                <ShieldCheck size={15} /> Teminatlarım
              </button>
              <button type="button" className={`sds-nav-item${tab === "certificates" ? " sds-nav-item--active" : ""}`} onClick={() => { changeTab("certificates"); setSidebarOpen(false); }}>
                <Award size={15} /> Sertifikalar
              </button>
              <button type="button" className={`sds-nav-item${tab === "company_docs" ? " sds-nav-item--active" : ""}`} onClick={() => { changeTab("company_docs"); setSidebarOpen(false); }}>
                <FolderOpen size={15} /> Şirket Evrakları
              </button>
              <button type="button" className={`sds-nav-item${tab === "personnel_docs" ? " sds-nav-item--active" : ""}`} onClick={() => { changeTab("personnel_docs"); setSidebarOpen(false); }}>
                <Users size={15} /> Personel Evrakları
              </button>
              <button type="button" className={`sds-nav-item${tab === "guarantee_docs" ? " sds-nav-item--active" : ""}`} onClick={() => { changeTab("guarantee_docs"); setSidebarOpen(false); }}>
                <Archive size={15} /> Alınan Teminatlar
              </button>
            </div>

            <div className="sds-nav-group">
              <div className="sds-nav-group-label">FİRMA</div>
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/firm-profile")}>
                <Building2 size={15} /> Firma Profili
              </button>
            </div>

            <div className="sds-nav-group">
              <div className="sds-nav-group-label">SİSTEM</div>
              <button type="button" className="sds-nav-item" onClick={() => { navigate("/supplier/dashboard"); setSidebarOpen(false); }}>
                <Settings2 size={15} /> Panel Ayarları
              </button>
            </div>
          </nav>

          <div className="sds-sidebar-footer">
            <button type="button" className="sds-logout-btn" onClick={handleLogout}>
              <LogOut size={13} /> Çıkış Yap
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className="sds-main">

          {/* White secondary toolbar */}
          <header className="sds-topbar">
            <nav className="sds-crumbs">
              <span>Tedarikçi</span>
              <span className="sds-crumb-sep">›</span>
              <b>{TAB_LABELS[tab]}</b>
            </nav>
            <div className="sds-top-actions">
              <LanguageSwitcher compact />
              <button type="button" className="sds-icon-btn" title="Bildirimler" aria-label="Bildirimler">
                <Bell size={16} />
              </button>
              <div className="sds-user-btn-wrap">
                <button type="button" className="sds-user-chip" onClick={() => setUserMenuOpen((p) => !p)}>
                  <div className="sds-user-av">{sidebarUserName.slice(0, 1).toUpperCase()}</div>
                  <div className="sds-user-meta">
                    <b>{sidebarUserName}</b>
                    <span>{sidebarUserRole}</span>
                  </div>
                </button>
                {userMenuOpen && (
                  <div className="sds-user-menu">
                    <div className="sds-user-menu__head">
                      <div className="sds-user-menu__name">{sidebarUserName}</div>
                      <div className="sds-user-menu__email">{sidebarUserRole}</div>
                    </div>
                    <button type="button" className="sds-user-menu-item" onClick={() => { setUserMenuOpen(false); navigate("/supplier/firm-profile"); }}>Firma Profili</button>
                    <button type="button" className="sds-user-menu-item" onClick={() => navigate("/supplier/dashboard")}>Panel Ana Sayfa</button>
                    <button type="button" className="sds-user-menu-item sds-user-menu-item--danger" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>Çıkış Yap</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="sds-content">
          <div className="swp-card">
            {/* Tab buttons kept for secondary navigation within content */}
            <div className="swp-tabs">{(["profile", "offers", "contracts", "guarantees", ...DOC_TABS] as WorkspaceTab[]).map((t) => (
              <button key={t} type="button" className={`swp-tab-btn${tab === t ? " swp-tab-btn--active" : ""}`} onClick={() => changeTab(t)}>
                {TAB_LABELS[t]}
              </button>
            ))}</div>

          {loading && <div className="swp-loading">Yükleniyor...</div>}

          {!loading && tab === "profile" && (
            <div className="swp-list">
              {profile ? (
                <>
                  <div className="swp-profile-grid">
                    <div><div className="swp-profile-grid__label">Firma</div><div className="swp-profile-grid__value">{profile.supplier.company_name || "-"}</div></div>
                    <div><div className="swp-profile-grid__label">Kategori</div><div className="swp-profile-grid__value">{profile.supplier.category || "-"}</div></div>
                    <div><div className="swp-profile-grid__label">Email</div><div className="swp-profile-grid__value">{profile.supplier.email || "-"}</div></div>
                    <div><div className="swp-profile-grid__label">Telefon</div><div className="swp-profile-grid__value">{profile.supplier.phone || "-"}</div></div>
                  </div>
                  <div className="swp-profile-actions">
                    <button type="button" className="swp-upload-btn" onClick={() => navigate("/supplier/profile")}>Profili Düzenle</button>
                    <button type="button" className="swp-upload-btn swp-upload-btn--dark" onClick={() => navigate("/supplier/finance")}>Finans Modülü</button>
                  </div>
                </>
              ) : (
                <div className="swp-loading">Profil bilgileri bulunamadı.</div>
              )}
            </div>
          )}

          {!loading && tab === "offers" && (
            <div className="swp-offers-wrap">
              <SupplierResponsePortal
                apiUrl={(import.meta.env.VITE_API_URL as string | undefined) || ""}
                authToken={getSupplierAccessToken() || ""}
              />
            </div>
          )}

          {!loading && tab === "contracts" && (
            <>
              <div className="swp-filter-row">
                <select
                  className="swp-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Sözleşme durumu filtresi"
                >
                  <option value="all">Tüm Durumlar</option>
                  <option value="draft">Taslak</option>
                  <option value="generated">Oluşturuldu</option>
                  <option value="sent">Gönderildi</option>
                  <option value="signed">İmzalı</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>
              <div className="swp-list">
                {filteredContracts.length === 0 && <div className="swp-loading">Sözleşme bulunmuyor.</div>}
                {filteredContracts.map((c) => (
                  <div key={c.id} className="swp-row">
                    <div>
                      <strong className="swp-row__title">{c.contract_number}</strong>
                      <div className="swp-row__meta">
                        <span>Teklif: {c.quote_id}</span>
                        <span>{c.final_amount ? `${c.final_amount.toLocaleString("tr-TR")} TL` : "-"}</span>
                      </div>
                    </div>
                    <span className="swp-row__status">{c.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {!loading && tab === "guarantees" && (
            <div className="swp-list">
              {guarantees.length === 0 && <div className="swp-loading">Teminat kaydı bulunmuyor.</div>}
              {guarantees.map((g) => (
                <div key={g.id} className="swp-row">
                  <div>
                    <strong className="swp-row__title">{g.title}</strong>
                    <div className="swp-row__sub">{g.amount ? `${g.amount.toLocaleString("tr-TR")} ${g.currency}` : "Tutar yok"}</div>
                  </div>
                  <span className="swp-row__status">{g.status}</span>
                </div>
              ))}
            </div>
          )}

          {!loading && isDocTab(tab) && (
            <>
              <div className="swp-filter-row">
                <input
                  className="swp-input"
                  value={fileNameFilter}
                  onChange={(e) => setFileNameFilter(e.target.value)}
                  placeholder="Dosya adına göre filtrele"
                  aria-label="Dosya adına göre filtrele"
                />
                <input
                  type="date"
                  className="swp-input"
                  value={docFromDate}
                  onChange={(e) => setDocFromDate(e.target.value)}
                  aria-label="Başlangıç tarihi"
                />
                <input
                  type="date"
                  className="swp-input"
                  value={docToDate}
                  onChange={(e) => setDocToDate(e.target.value)}
                  aria-label="Bitiş tarihi"
                />
                <button type="button" className="swp-upload-btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? "⏳ Yükleniyor..." : "+ Evrak Yükle"}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="swp-hidden"
                onChange={handleUpload}
                aria-label="Evrak dosyası seç"
              />
              <div className="swp-list">
                {filteredDocuments.length === 0 && <div className="swp-loading">Filtreye uygun evrak yok.</div>}
                {filteredDocuments.map((d) => (
                  <div key={d.id} className="swp-row">
                    <div>
                      <div className="swp-row__filename">{d.original_filename}</div>
                      <div className="swp-row__date">{d.created_at ? new Date(d.created_at).toLocaleString("tr-TR") : "Tarih bilgisi yok"}</div>
                    </div>
                    <a href="#" className="swp-row__link" onClick={(e) => { e.preventDefault(); void openDocument(d); }}>Aç</a>
                  </div>
                ))}
              </div>
            </>
          )}
          </div>{/* /swp-card */}
        </div>{/* /sds-content */}

        {toast && <div className={`swp-toast swp-toast--${toast.type}`}>{toast.msg}</div>}

      </div>{/* /sds-main */}

      </div>{/* /sds-shell */}

      {userMenuOpen && <div className="sds-overlay" onClick={() => setUserMenuOpen(false)} />}
    </div>
  );
}
