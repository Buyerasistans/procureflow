import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken, getSupplierAccessToken } from "../lib/session";
import { panelProfileCssVars } from "../admin/panel-designer.helpers";
import { getCityNames, getDistricts } from "../data/turkey-cities";
import {
  Archive, Award, Bell, Briefcase, Building2, FileCheck, FileText, FolderOpen,
  Home, Lock, LogOut, Mail, MapPin, Menu, Phone, Settings2, ShieldCheck, User, Users,
} from "lucide-react";
import PublicBrandLogo from "../components/PublicBrandLogo";
import LanguageSwitcher from "../components/LanguageSwitcher";
import {
  getSupplierProfile,
  getSupplierEmailChangeStatus,
  updateSupplierProfile,
  type SupplierProfileResponse,
} from "../services/supplier-profile.service";
import "./SupplierDashboard.css";
import "./SupplierPersonalProfilePage.css";

const SUPPLIER_PANEL = { color: "#0c4a6e", color2: "#38bdf8", color2Mix: 0.22, accent: "#0E7490", textColor: "#f0f9ff" } as const;

function getInitials(name: string) {
  return name.trim().split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

function buildMapSrc(query: string, type: "satellite" | "roadmap") {
  const t = type === "satellite" ? "k" : "m";
  return `https://maps.google.com/maps?output=embed&t=${t}&q=${encodeURIComponent(query + ", Türkiye")}`;
}

export default function SupplierPersonalProfilePage() {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<SupplierProfileResponse | null>(null);
  const [emailPending, setEmailPending] = useState(false);
  const [roleText, setRoleText] = useState("Tedarikçi Kullanıcısı");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formWorkEmail, setFormWorkEmail] = useState("");
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const [formCity, setFormCity] = useState("");
  const [formDistrict, setFormDistrict] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPostal, setFormPostal] = useState("");

  // Map state
  const [mapOpen, setMapOpen] = useState(false);
  const [mapType, setMapType] = useState<"satellite" | "roadmap">("satellite");

  const cityOptions = useMemo(() => getCityNames(), []);
  const districtOptions = useMemo(() => (formCity ? getDistricts(formCity) : []), [formCity]);

  const flash = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const syncFormFromProfile = (data: SupplierProfileResponse) => {
    setFormName(data.user?.name || "");
    setFormPhone(data.user?.phone || "");
    setFormWorkEmail(data.user?.work_email || "");
    setFormPhoto(data.user?.photo || null);
    setFormCity(data.user?.city || "");
    setFormDistrict(data.user?.address_district || "");
    setFormAddress(data.user?.address || "");
    setFormPostal(data.user?.postal_code || "");
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [data, status] = await Promise.all([
        getSupplierProfile(),
        getSupplierEmailChangeStatus(),
      ]);
      setProfile(data);
      syncFormFromProfile(data);
      setEmailPending(status.pending);
    } catch {
      flash("Profil yüklenemedi", "error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const vars = panelProfileCssVars({
      color: SUPPLIER_PANEL.color, color2: SUPPLIER_PANEL.color2,
      color2Mix: SUPPLIER_PANEL.color2Mix, accent: SUPPLIER_PANEL.accent,
      textColor: SUPPLIER_PANEL.textColor,
    });
    Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
  }, [loading]);

  useEffect(() => {
    if (!getSupplierAccessToken()) { navigate("/supplier/login", { replace: true }); return; }
    void load();
  }, [load, navigate]);

  useEffect(() => {
    const raw = localStorage.getItem("pf_user") || sessionStorage.getItem("pf_user");
    if (!raw) return;
    const p = JSON.parse(raw) as { business_role?: string; system_role?: string; role_profile_code?: string };
    const br = String(p.business_role || "").toLowerCase();
    const sr = String(p.system_role || "").toLowerCase();
    const code = String(p.role_profile_code || "").trim();
    if (br === "supplier_admin") setRoleText(code || "Tedarikçi Yöneticisi");
    else if (br === "supplier_user" || sr === "supplier_user") setRoleText(code || "Tedarikçi Kullanıcısı");
    else setRoleText(code || "Tedarikçi");
  }, []);

  const handleLogout = () => { clearToken(); navigate("/supplier/login", { replace: true }); };

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { flash("Fotoğraf 2 MB'dan küçük olmalı.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setFormPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    try {
      setSaving(true);
      setSaveMsg(null);
      await updateSupplierProfile({
        user_name: formName,
        user_phone: formPhone,
        user_work_email: formWorkEmail || null,
        user_photo: formPhoto || null,
        user_city: formCity || null,
        user_address_district: formDistrict || null,
        user_address: formAddress || null,
        user_postal_code: formPostal || null,
      });
      setProfile(prev => prev ? {
        ...prev,
        user: {
          ...prev.user,
          name: formName, phone: formPhone, work_email: formWorkEmail,
          photo: formPhoto, city: formCity, address_district: formDistrict,
          address: formAddress, postal_code: formPostal,
        },
      } : prev);
      setSaveMsg({ ok: true, text: "Profil kaydedildi." });
      setEditing(false);
    } catch {
      setSaveMsg({ ok: false, text: "Kaydetme başarısız." });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) syncFormFromProfile(profile);
    setEditing(false);
    setSaveMsg(null);
  };

  const logoSrc = (() => {
    const url = profile?.supplier.logo_url;
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${(import.meta.env.VITE_API_BASE_URL as string) || ""}${url}`;
  })();

  if (loading || !profile) {
    return (
      <div className="sds-wrap" ref={wrapRef}>
        <header className="sds-panel-top" />
        <div className="sds-shell">
          <aside className="sds-sidebar" />
          <div className="sds-main">
            <div className="sds-loading-center">Yükleniyor...</div>
          </div>
        </div>
      </div>
    );
  }

  const firmName = profile.supplier.company_name;
  const userName = profile.user?.name || "";
  const userEmail = profile.user?.email || "";
  const userPhone = profile.user?.phone || "";
  const userWorkEmail = profile.user?.work_email || "";
  const displayPhoto = editing ? formPhoto : (profile.user?.photo || null);
  const initials = getInitials(userName);
  const waPhone = userPhone.replace(/[\s\-\(\)]/g, "").replace(/^0/, "90").replace(/^\+/, "");

  // Build personal address display & map query
  const addrParts = [profile.user?.city, profile.user?.address_district, profile.user?.address].filter(Boolean);
  const mapQuery = addrParts.join(", ");
  const addrDisplay = addrParts.join(" / ");

  return (
    <div className="sds-wrap" ref={wrapRef}>

      <header className="sds-panel-top">
        <div className="sds-pt-brand">
          <button type="button" className="sds-hamburger" onClick={() => setSidebarOpen(p => !p)} aria-label="Menüyü aç">
            <Menu size={18} />
          </button>
          <PublicBrandLogo height={44} maxWidth={160} invert />
        </div>
        <div className="sds-pt-center">
          <div className="sds-pt-title-row">
            <span className="sds-pt-platform">Tedarikçi Yönetim Paneli</span>
            <span className="sds-pt-dot">·</span>
            <span className="sds-pt-title">{roleText}</span>
            <span className="sds-pt-ver">v3.4</span>
          </div>
        </div>
        <div className="sds-pt-welcome">
          <span className="sds-pt-hi">Hoş geldiniz</span>
          <b className="sds-pt-name">{userName}</b>
        </div>
      </header>

      <div className="sds-shell">
        {sidebarOpen && <div className="sds-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sds-sidebar${sidebarOpen ? " sds-sidebar--open" : ""}`}>
          <div className="sds-tenant-block">
            {logoSrc
              ? <img className="sds-tenant-avatar__img" src={logoSrc} alt={firmName} />
              : <div className="sds-tenant-avatar">{firmName.slice(0, 2).toUpperCase()}</div>
            }
            <div>
              <div className="sds-tenant-name">{firmName}</div>
              <div className="sds-tenant-role">{roleText}</div>
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
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/workspace?tab=offers")}>
                <FileText size={15} /> Tekliflerim
              </button>
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/workspace?tab=contracts")}>
                <FileCheck size={15} /> Sözleşmelerim
              </button>
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/workspace?tab=guarantees")}>
                <ShieldCheck size={15} /> Teminatlarım
              </button>
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/workspace?tab=certificates")}>
                <Award size={15} /> Sertifikalar
              </button>
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/workspace?tab=company_docs")}>
                <FolderOpen size={15} /> Şirket Evrakları
              </button>
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/workspace?tab=personnel_docs")}>
                <Users size={15} /> Personel Evrakları
              </button>
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/workspace?tab=guarantee_docs")}>
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
              <div className="sds-nav-group-label">KİŞİSEL</div>
              <button type="button" className="sds-nav-item sds-nav-item--active" onClick={() => navigate("/supplier/profile")}>
                <User size={15} /> Profilim
              </button>
            </div>
            <div className="sds-nav-group">
              <div className="sds-nav-group-label">SİSTEM</div>
              <button type="button" className="sds-nav-item" onClick={() => navigate("/supplier/dashboard")}>
                <Settings2 size={15} /> Sistem Ayarları
              </button>
            </div>
          </nav>

          <div className="sds-sidebar-footer">
            <button type="button" className="sds-logout-btn" onClick={handleLogout}>
              <LogOut size={13} /> Çıkış Yap
            </button>
          </div>
        </aside>

        <div className="sds-main">
          <header className="sds-topbar">
            <nav className="sds-crumbs">
              <span>Tedarikçi</span>
              <span className="sds-crumb-sep">›</span>
              <b>Profilim</b>
            </nav>
            <div className="sds-top-actions">
              <LanguageSwitcher compact />
              <button type="button" className="sds-icon-btn" title="Bildirimler" aria-label="Bildirimler">
                <Bell size={16} />
              </button>
              <div className="sds-user-btn-wrap">
                <button type="button" className="sds-user-chip" onClick={() => setUserMenuOpen(p => !p)}>
                  <div className="sds-user-av">{initials.slice(0, 1)}</div>
                  <div className="sds-user-meta">
                    <b>{userName}</b>
                    <span>{userEmail}</span>
                  </div>
                </button>
                {userMenuOpen && (
                  <div className="sds-user-menu">
                    <div className="sds-user-menu__head">
                      <div className="sds-user-menu__name">{userName}</div>
                      <div className="sds-user-menu__email">{userEmail}</div>
                    </div>
                    <button type="button" className="sds-user-menu-item" onClick={() => { setUserMenuOpen(false); navigate("/supplier/profile"); }}>Profilim</button>
                    <button type="button" className="sds-user-menu-item sds-user-menu-item--danger" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>Çıkış Yap</button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="sds-content">
            <div className="sppp-wrap">

              {/* ── Header ── */}
              <div className="sppp-header">
                <div className="sppp-avatar-wrap">
                  <div className="sppp-avatar">
                    {displayPhoto
                      ? <img src={displayPhoto} alt={userName} className="sppp-avatar__img" />
                      : initials
                    }
                  </div>
                  {editing && (
                    <label className="sppp-avatar-upload" title="Fotoğraf yükle" aria-label="Fotoğraf yükle">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} />
                    </label>
                  )}
                </div>

                <div className="sppp-header-info">
                  {editing ? (
                    <input
                      className="sppp-name-input"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Ad Soyad"
                    />
                  ) : (
                    <h1 className="sppp-header-name">{userName || "—"}</h1>
                  )}
                  <div className="sppp-header-badges">
                    <span className="sppp-badge sppp-badge--role">{roleText}</span>
                    <span className="sppp-badge sppp-badge--active">Aktif</span>
                  </div>
                </div>

                <div className="sppp-header-actions">
                  {!editing ? (
                    <button type="button" className="sppp-btn sppp-btn--secondary" onClick={() => { setEditing(true); setSaveMsg(null); }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Düzenle
                    </button>
                  ) : (
                    <>
                      <button type="button" className="sppp-btn sppp-btn--primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Kaydediliyor..." : "Kaydet"}
                      </button>
                      <button type="button" className="sppp-btn sppp-btn--secondary" onClick={handleCancelEdit} disabled={saving}>
                        İptal
                      </button>
                    </>
                  )}
                </div>
              </div>

              {saveMsg && (
                <div className="sppp-save-msg-bar">
                  <p className={`sppp-save-msg ${saveMsg.ok ? "sppp-save-msg--ok" : "sppp-save-msg--err"}`}>
                    {saveMsg.text}
                  </p>
                </div>
              )}

              {/* ── Body ── */}
              <div className="sppp-body">

                {/* ── Sol kolon ── */}
                <div>

                  {/* İletişim Bilgileri */}
                  <div className="sppp-card">
                    <div className="sppp-card__head">
                      <h3 className="sppp-card__title">
                        <svg className="sppp-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        İletişim Bilgileri
                      </h3>
                    </div>
                    <div className="sppp-card__body">

                      <div className="sppp-field">
                        <span className="sppp-field__label">E-posta</span>
                        <span className="sppp-field__value sppp-field__value--email">
                          {userEmail ? (
                            <a href={`mailto:${userEmail}`} className="sppp-contact-link">
                              <Mail size={12} />{userEmail}
                            </a>
                          ) : "—"}
                          {emailPending && <span className="sppp-email-status">⏳ Doğrulama bekliyor</span>}
                        </span>
                      </div>

                      <div className="sppp-field">
                        <span className="sppp-field__label">İş E-posta</span>
                        {editing ? (
                          <input className="sppp-input" type="email" value={formWorkEmail} onChange={e => setFormWorkEmail(e.target.value)} placeholder="is@firma.com" />
                        ) : (
                          <span className={`sppp-field__value${!userWorkEmail ? " sppp-field__value--muted" : ""}`}>
                            {userWorkEmail || "Belirtilmemiş"}
                          </span>
                        )}
                      </div>

                      <div className="sppp-field">
                        <span className="sppp-field__label">Cep Telefonu</span>
                        {editing ? (
                          <input className="sppp-input" type="tel" value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="05XX XXX XX XX" />
                        ) : (
                          <span className={`sppp-field__value${!userPhone ? " sppp-field__value--muted" : ""}`}>
                            {userPhone ? (
                              <span className="sppp-phone-row">
                                <a href={`tel:${userPhone}`} className="sppp-contact-link"><Phone size={12} />{userPhone}</a>
                                <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noopener noreferrer" className="sppp-contact-link sppp-contact-link--wa" title="WhatsApp">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                  </svg>
                                </a>
                              </span>
                            ) : "Belirtilmemiş"}
                          </span>
                        )}
                      </div>

                      {!editing && userPhone && (
                        <div className="sppp-wa-share-row">
                          <a href={`https://wa.me/?text=${encodeURIComponent([userName, userPhone].filter(Boolean).join(" — "))}`} target="_blank" rel="noopener noreferrer" className="sppp-wa-share-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            WhatsApp'ta Paylaş
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Kişisel Adres */}
                  <div className="sppp-card">
                    <div className="sppp-card__head">
                      <h3 className="sppp-card__title">
                        <svg className="sppp-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        Kişisel Adres
                      </h3>
                    </div>
                    <div className="sppp-card__body">
                      {editing ? (
                        <div className="sppp-address-fields">
                          <div className="sppp-field">
                            <span className="sppp-field__label">İl</span>
                            <select
                              className="sppp-input sppp-select"
                              value={formCity}
                              onChange={e => { setFormCity(e.target.value); setFormDistrict(""); }}
                              aria-label="İl seçiniz"
                            >
                              <option value="">İl seçiniz</option>
                              {cityOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div className="sppp-field">
                            <span className="sppp-field__label">İlçe</span>
                            <select
                              className="sppp-input sppp-select"
                              value={formDistrict}
                              onChange={e => setFormDistrict(e.target.value)}
                              disabled={!formCity}
                              aria-label="İlçe seçiniz"
                            >
                              <option value="">İlçe seçiniz</option>
                              {districtOptions.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div className="sppp-field">
                            <span className="sppp-field__label">Detaylı Adres</span>
                            <input
                              className="sppp-input"
                              type="text"
                              value={formAddress}
                              onChange={e => setFormAddress(e.target.value)}
                              placeholder="Mahalle, cadde, kapı no..."
                            />
                          </div>
                          <div className="sppp-field">
                            <span className="sppp-field__label">Posta Kodu</span>
                            <input
                              className="sppp-input sppp-input--short"
                              type="text"
                              value={formPostal}
                              onChange={e => setFormPostal(e.target.value)}
                              placeholder="34000"
                              maxLength={10}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="sppp-field">
                            <span className="sppp-field__label">İl / İlçe</span>
                            <span className={`sppp-field__value${!profile.user?.city ? " sppp-field__value--muted" : ""}`}>
                              {[profile.user?.city, profile.user?.address_district].filter(Boolean).join(" / ") || "Belirtilmemiş"}
                            </span>
                          </div>
                          <div className="sppp-field">
                            <span className="sppp-field__label">Adres</span>
                            <span className={`sppp-field__value${!profile.user?.address ? " sppp-field__value--muted" : ""}`}>
                              {profile.user?.address || "Belirtilmemiş"}
                            </span>
                          </div>
                          {profile.user?.postal_code && (
                            <div className="sppp-field">
                              <span className="sppp-field__label">Posta Kodu</span>
                              <span className="sppp-field__value">{profile.user.postal_code}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Konum Haritası */}
                  <div className="sppp-card">
                    <div className="sppp-card__head sppp-map-head">
                      <h3 className="sppp-card__title">
                        <svg className="sppp-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18M9 21V9" />
                        </svg>
                        Konum Haritası
                      </h3>
                      <div className="sppp-map-head__actions">
                        {mapOpen && mapQuery && (
                          <div className="sppp-map-type-toggle">
                            <button type="button" className={`sppp-btn sppp-btn--sm ${mapType === "satellite" ? "sppp-btn--primary" : "sppp-btn--secondary"}`} onClick={() => setMapType("satellite")}>
                              🛰️ Uydu
                            </button>
                            <button type="button" className={`sppp-btn sppp-btn--sm ${mapType === "roadmap" ? "sppp-btn--primary" : "sppp-btn--secondary"}`} onClick={() => setMapType("roadmap")}>
                              🗺️ Harita
                            </button>
                          </div>
                        )}
                        <button type="button" className="sppp-btn sppp-btn--sm sppp-btn--secondary" onClick={() => setMapOpen(v => !v)}>
                          {mapOpen ? "▲ Kapat" : "▼ Aç"}
                        </button>
                      </div>
                    </div>
                    {mapOpen && (
                      mapQuery ? (
                        <div className="sppp-map-frame-wrap">
                          <iframe
                            title="Konum haritası"
                            className="sppp-map-iframe"
                            src={buildMapSrc(mapQuery, mapType)}
                            loading="lazy"
                            allowFullScreen
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                      ) : (
                        <div className="sppp-map-placeholder">
                          <MapPin size={18} />
                          <p>Adres girilmemiş, harita gösterilemiyor.</p>
                        </div>
                      )
                    )}
                  </div>

                </div>

                {/* ── Sağ kolon ── */}
                <div>

                  {/* Organizasyon */}
                  <div className="sppp-card">
                    <div className="sppp-card__head">
                      <h3 className="sppp-card__title">
                        <svg className="sppp-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Organizasyon
                      </h3>
                    </div>
                    <div className="sppp-card__body">
                      <div className="sppp-field">
                        <span className="sppp-field__label">Kurum</span>
                        <span className="sppp-field__value">{firmName}</span>
                      </div>
                      <button type="button" className="sppp-link-btn" onClick={() => navigate("/supplier/firm-profile")}>
                        → Firma Profilini Görüntüle
                      </button>
                    </div>
                  </div>

                  {/* Rol ve İzinler */}
                  <div className="sppp-card">
                    <div className="sppp-card__head">
                      <h3 className="sppp-card__title">
                        <svg className="sppp-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Rol ve İzinler
                      </h3>
                    </div>
                    <div className="sppp-card__body">
                      <div className="sppp-chips">
                        <span className="sppp-chip sppp-chip--role">{roleText}</span>
                        <span className="sppp-chip sppp-chip--active">Tedarikçi</span>
                      </div>
                    </div>
                  </div>

                  {/* Kariyer — Yakında */}
                  <div className="sppp-card sppp-card--soon">
                    <div className="sppp-card__head">
                      <h3 className="sppp-card__title">
                        <Briefcase size={15} className="sppp-card__title-icon" />
                        Kariyer
                      </h3>
                      <span className="sppp-soon-badge">Yakında</span>
                    </div>
                    <div className="sppp-card__body">
                      <div className="sppp-soon-body">
                        <div className="sppp-soon-icon"><Briefcase size={28} /></div>
                        <p className="sppp-soon-title">İş Arama Profili</p>
                        <p className="sppp-soon-desc">
                          Kariyer profilinizi oluşturun, iş ilanlarına başvurun ve fırsatları takip edin.
                        </p>
                        <span className="sppp-soon-tag">🚀 Çok Yakında</span>
                      </div>
                    </div>
                  </div>

                  {/* Güvenlik */}
                  <div className="sppp-card">
                    <div className="sppp-card__head">
                      <h3 className="sppp-card__title">
                        <svg className="sppp-card__title-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Güvenlik
                      </h3>
                    </div>
                    <div className="sppp-card__body">
                      <div className="sppp-security-row">
                        <div>
                          <div className="sppp-security-label">E-Posta Değişikliği</div>
                          <div className="sppp-security-sub">Giriş e-postanızı güncelleyin</div>
                        </div>
                        <button type="button" className="sppp-btn sppp-btn--sm sppp-btn--secondary" onClick={() => navigate("/supplier/firm-profile")}>
                          Güncelle
                        </button>
                      </div>
                      <div className="sppp-pwd-btn-wrap">
                        <button type="button" className="sppp-btn sppp-btn--pwd sppp-btn--full" onClick={() => navigate("/supplier/workspace?tab=profile")}>
                          <Lock size={13} />
                          Şifre Değiştir
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </div>
        </div>
      </div>

      {userMenuOpen && <div className="sds-overlay" onClick={() => setUserMenuOpen(false)} />}
      {toast && <div className={`sppp-toast sppp-toast--${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
